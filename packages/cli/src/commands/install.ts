import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import { confirm, isCancel, select, spinner, cancel } from '@clack/prompts';
import { runAllChecks } from '../prereqs.js';
import { generateCompose, InstallManifest } from '../compose-generator.js';
import { CredentialManager } from '../credentials.js';
import type { PrereqCheckResult } from '../prereqs.js';
import { enrollmentFlow } from './enrollment.js';
import { bootstrapFlow } from './bootstrap.js';
import { StateManager } from '../managers/state-manager.js';
import { InstallPlanner } from '../services/install-planner.js';
import { resolvePublishedImageManifest } from '../services/image-manifest.js';
import { normalizeInstallProfile } from '../services/install-profile.js';
import { NodeBundleInstaller } from '../services/node-bundle-installer.js';
import { ConnectionProfileStore } from '../stores/connection-profile-store.js';
import { seedInitialGraph } from '../services/initial-graph.js';
import {
  buildDependencyInstallPrompt,
  buildDockerDaemonStartPrompt,
  installMissingDependencies,
  startDockerDaemon,
  splitPrereqFailures,
} from '../services/dependency-installer.js';
import { CLI_VERSION } from '../version.js';

function abortInstall(message: string): never {
  throw new Error(message);
}

function formatChoiceLabel(value: string): string {
  return value
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function promptCancelled(message: string): never {
  cancel(message);
  throw new Error(message);
}

async function promptChoice(question: string, options: string[]): Promise<string> {
  const result = await select({
    message: question,
    options: options.map((option) => ({
      value: option,
      label: formatChoiceLabel(option),
    })),
  });

  if (isCancel(result)) {
    promptCancelled('Installation was cancelled.');
  }

  return String(result);
}

async function promptYesNo(question: string): Promise<boolean> {
  const result = await confirm({
    message: question,
    initialValue: true,
  });

  if (isCancel(result)) {
    promptCancelled('Installation was cancelled.');
  }

  return Boolean(result);
}

function printPrereqFailures(results: PrereqCheckResult[]): void {
  results.forEach((result) => {
    console.error(`✗ ${result.message}`);
    if (result.remediation) {
      console.error(`  ${result.remediation}`);
    }
  });
}

function printAdminAccessGuidance(context: string): void {
  console.error(context);
  console.error('Re-run this installer from an administrator shell or a sudo-capable user, then try again.');
}

function getRequiredBundleImages(profile: 'discovery' | 'full'): string[] {
  if (profile === 'full') {
    return ['api', 'dashboard', 'neo4j', 'discovery', 'cartography', 'chatbot'];
  }

  return ['api', 'dashboard', 'neo4j', 'discovery', 'cartography'];
}

function ensureRequiredBundleImages(
  images: Record<string, string>,
  profile: 'discovery' | 'full'
): void {
  const missing = getRequiredBundleImages(profile).filter((service) => !images[service]);
  if (missing.length > 0) {
    throw new Error(`Published image manifest is missing pinned images for: ${missing.join(', ')}`);
  }
}

async function displayProfileDetails(profile: 'discovery' | 'full'): Promise<void> {
  const servicesByProfile: Record<'discovery' | 'full', string[]> = {
    discovery: ['API', 'Dashboard', 'Neo4j', 'Discovery', 'Cartography', 'cig-node'],
    full: ['API', 'Dashboard', 'Neo4j', 'Discovery', 'Cartography', 'cig-node', 'Chatbot'],
  };

  console.log(`\n${profile.toUpperCase()} profile services:`);
  servicesByProfile[profile].forEach((service) => console.log(`  - ${service}`));
}

async function pollHealthChecks(manifest: InstallManifest, timeoutMs = 300_000): Promise<boolean> {
  const healthEndpoints: Record<string, string> = {
    api: 'http://127.0.0.1:8000/api/v1/health',
    dashboard: 'http://127.0.0.1:3000',
    discovery: 'http://127.0.0.1:8080/health',
  };

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    let healthy = true;

    for (const service of manifest.services) {
      const endpoint = healthEndpoints[service];
      if (!endpoint) {
        continue;
      }

      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          healthy = false;
        }
      } catch {
        healthy = false;
      }
    }

    if (healthy) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  return false;
}

async function rollback(installDir: string): Promise<void> {
  try {
    execSync('docker compose down', { cwd: installDir, stdio: 'pipe' });
  } catch {
    // Best effort only.
  }

  for (const fileName of ['docker-compose.yml', '.env']) {
    const filePath = `${installDir}/${fileName}`;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

export async function install(
  apiUrl = 'http://localhost:8000',
  mode?: 'managed' | 'self-hosted',
  profile?: 'core' | 'discovery' | 'full'
): Promise<void> {
  const credentialManager = new CredentialManager();
  const stateManager = new StateManager();
  const planner = new InstallPlanner();
  const profileStore = new ConnectionProfileStore();

  console.log(`\nCIG installation (v${CLI_VERSION})`);

  const checkSpinner = spinner();
  checkSpinner.start('Running CIG prerequisite checks...');
  let prereqResults = await runAllChecks();
  checkSpinner.stop('CIG prerequisite checks completed.');
  let failedChecks = prereqResults.filter((result) => !result.passed);
  if (failedChecks.length > 0) {
    let groups = splitPrereqFailures(failedChecks);
    printPrereqFailures(failedChecks);

    if (groups.admin.length > 0) {
      printAdminAccessGuidance('Docker is installed, but this user cannot access the daemon.');
      abortInstall('Docker daemon access requires administrator privileges in this environment.');
    }

    if (groups.startable.length > 0) {
      const shouldStartDocker = await promptYesNo(buildDockerDaemonStartPrompt(groups));
      if (!shouldStartDocker) {
        abortInstall('Docker daemon startup was skipped by the operator.');
      }

      const startSpinner = spinner();
      startSpinner.start('Starting Docker daemon...');
      const startResult = await startDockerDaemon();
      startSpinner.stop(startResult.succeeded ? 'Docker daemon start attempted.' : 'Docker daemon start failed.');
      if (!startResult.succeeded) {
        console.error(startResult.summary);
        if (startResult.requiresAdmin) {
          printAdminAccessGuidance('Docker daemon startup requires administrator privileges in this environment.');
        }
        if (startResult.error) {
          console.error(startResult.error);
        }
        abortInstall('Docker daemon startup did not complete.');
      }

      console.log(startResult.summary);
      checkSpinner.start('Re-running prerequisite checks...');
      prereqResults = await runAllChecks();
      checkSpinner.stop('Prerequisite checks completed.');
      failedChecks = prereqResults.filter((result) => !result.passed);
      groups = splitPrereqFailures(failedChecks);
      if (failedChecks.length > 0) {
        printPrereqFailures(failedChecks);
        if (groups.startable.length > 0) {
          console.error('Docker is still not running after the automatic start attempt.');
          abortInstall('Prerequisite checks still failed after attempting to start Docker.');
        }
      }
    }

    if (groups.installable.length > 0) {
      const shouldTryInstall = await promptYesNo(buildDependencyInstallPrompt(groups));
      if (!shouldTryInstall) {
        abortInstall('Automatic Docker prerequisite installation was skipped by the operator.');
      }

      const installSpinner = spinner();
      installSpinner.start('Installing Docker prerequisites...');
      const installResult = await installMissingDependencies();
      installSpinner.stop(installResult.succeeded ? 'Docker prerequisite installation attempted.' : 'Docker prerequisite installation failed.');
      if (!installResult.succeeded) {
        console.error(installResult.summary);
        if (installResult.requiresAdmin) {
          printAdminAccessGuidance('Installing Docker prerequisites requires administrator privileges in this environment.');
        }
        if (installResult.error) {
          console.error(installResult.error);
        }
        abortInstall('Automatic Docker prerequisite installation did not complete.');
      }

      console.log(installResult.summary);

      checkSpinner.start('Re-running prerequisite checks...');
      const retryResults = await runAllChecks();
      checkSpinner.stop('Prerequisite checks completed.');
      const remainingFailures = retryResults.filter((result) => !result.passed);
      groups = splitPrereqFailures(remainingFailures);
      if (remainingFailures.length > 0) {
        console.error('Some prerequisites are still missing after the automatic install attempt:');
        printPrereqFailures(remainingFailures);
        if (groups.startable.length > 0) {
          console.error('Docker is still not running after the automatic install attempt.');
        }
        abortInstall('Prerequisite checks still failed after attempting automatic remediation.');
      }
    }

    if (groups.startable.length > 0) {
      console.error('Docker is still not running. Start it manually and try again.');
      abortInstall('Docker daemon is not running.');
    }

    if (groups.manual.length > 0) {
      console.error('Some prerequisites require manual remediation before installation can continue.');
      abortInstall('Manual prerequisite remediation is required before installation can continue.');
    }
  }

  if (!mode) {
    mode = (await promptChoice('Select installation mode:', ['self-hosted', 'managed'])) as
      | 'managed'
      | 'self-hosted';
  }

  if (!profile) {
    profile = (await promptChoice('Select installation profile:', ['discovery', 'full'])) as
      | 'discovery'
      | 'full';
  }

  const installProfile = normalizeInstallProfile(profile);
  await displayProfileDetails(installProfile);

  let publishedImageManifest: Record<string, string> | undefined;
  if (mode === 'self-hosted') {
    const resolvedImageManifest = await resolvePublishedImageManifest(CLI_VERSION);
    ensureRequiredBundleImages(resolvedImageManifest.images, installProfile);
    publishedImageManifest = resolvedImageManifest.images;
    console.log(`✓ Resolved published image manifest v${resolvedImageManifest.version}.`);
  }

  const plan = planner.createPlan({ mode, profile: installProfile, apiUrl });
  const installDir = plan.installDir;
  fs.mkdirSync(installDir, { recursive: true, mode: 0o700 });

  let manifest: InstallManifest;
  let identity = credentialManager.loadIdentity();

  if (mode === 'managed') {
    const result = await enrollmentFlow({ apiUrl, profile: installProfile });
    manifest = result.manifest;
    identity = result.identity;
  } else {
    manifest = await bootstrapFlow({ profile: installProfile });
  }

  manifest.profile = installProfile;
  if (publishedImageManifest) {
    manifest.service_images = publishedImageManifest;
  }
  await generateCompose(manifest, installDir);

  if (identity) {
    const bundleInstaller = new NodeBundleInstaller(installDir);
    bundleInstaller.writeBundle(plan.nodeConfig, {
      nodeId: identity.targetId,
      publicKey: identity.publicKey,
      privateKey: identity.privateKey,
      enrolledAt: identity.enrolledAt,
    });
  }

  if (mode === 'self-hosted') {
    try {
      execSync('docker compose up -d', { cwd: installDir, stdio: 'inherit' });
    } catch (error) {
      await rollback(installDir);
      throw error;
    }

    const healthChecksPassed = await pollHealthChecks(manifest);
    if (!healthChecksPassed) {
      await rollback(installDir);
      throw new Error('Timed out waiting for self-hosted services to become healthy');
    }
  } else {
    console.log('Managed mode staged the node runtime bundle only. Install it on the target host via SSH/systemd.');
  }

  await stateManager.save({
    version: CLI_VERSION,
    mode,
    profile,
    installDir,
    installedAt: new Date().toISOString(),
    status: mode === 'self-hosted' ? 'ready' : 'stopped',
    services: manifest.services.map((service) => ({
      name: service,
      status: mode === 'self-hosted' ? 'running' : 'stopped',
    })),
  });

  const now = new Date().toISOString();
  profileStore.save({
    id: mode === 'self-hosted' ? 'self-hosted-local' : 'managed-cloud',
    name: mode === 'self-hosted' ? 'Self-hosted Local' : 'Managed Cloud',
    type: mode === 'self-hosted' ? 'self-hosted' : 'managed-cloud',
    apiUrl,
    authMode: mode,
    dashboardUrl: mode === 'self-hosted' ? 'http://127.0.0.1:3000' : apiUrl,
    createdAt: now,
    updatedAt: now,
    isDefault: true,
  });
  profileStore.setDefault(mode === 'self-hosted' ? 'self-hosted-local' : 'managed-cloud');

  const graphBootstrap = await seedInitialGraph({
    installDir,
    apiUrl,
    mode,
    profile,
    credentialManager,
  });

  console.log(`✓ Installation assets written to ${installDir}`);
  if (graphBootstrap.uploaded) {
    console.log(`✓ Initial graph seeded and uploaded (${graphBootstrap.assetCount} assets).`);
  } else {
    console.log(`✓ Initial graph snapshot saved to ${graphBootstrap.artifactPath}.`);
    console.log('  It will upload automatically after authentication is available.');
  }
  if (mode === 'self-hosted') {
    console.log('Open http://127.0.0.1:3000 to complete bootstrap.');
  }
}
