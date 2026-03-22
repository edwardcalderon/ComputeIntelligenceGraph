import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import * as readline from 'node:readline';
import { runAllChecks } from '../prereqs.js';
import { generateCompose, InstallManifest } from '../compose-generator.js';
import { CredentialManager } from '../credentials.js';
import { enrollmentFlow } from './enrollment.js';
import { bootstrapFlow } from './bootstrap.js';
import { StateManager } from '../managers/state-manager.js';
import { InstallPlanner } from '../services/install-planner.js';
import { NodeBundleInstaller } from '../services/node-bundle-installer.js';
import { ConnectionProfileStore } from '../stores/connection-profile-store.js';
import { CLI_VERSION } from '../version.js';

async function promptChoice(question: string, options: string[]): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log(`\n${question}`);
    options.forEach((option, index) => {
      console.log(`  ${index + 1}. ${option}`);
    });

    rl.question(`Enter your choice (1-${options.length}): `, (answer) => {
      rl.close();
      const selectedIndex = parseInt(answer, 10) - 1;
      if (selectedIndex < 0 || selectedIndex >= options.length) {
        console.error('Invalid selection');
        process.exit(1);
      }

      resolve(options[selectedIndex]);
    });
  });
}

async function displayProfileDetails(profile: 'core' | 'full'): Promise<void> {
  const servicesByProfile: Record<'core' | 'full', string[]> = {
    core: ['API', 'Dashboard', 'Neo4j', 'Discovery', 'Cartography', 'cig-node'],
    full: ['API', 'Dashboard', 'Neo4j', 'Discovery', 'Cartography', 'cig-node', 'Chatbot', 'Agents'],
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
  profile?: 'core' | 'full'
): Promise<void> {
  const credentialManager = new CredentialManager();
  const stateManager = new StateManager();
  const planner = new InstallPlanner();
  const profileStore = new ConnectionProfileStore();

  console.log('\nCIG installation');

  const prereqResults = await runAllChecks();
  const failedChecks = prereqResults.filter((result) => !result.passed);
  if (failedChecks.length > 0) {
    failedChecks.forEach((result) => {
      console.error(`✗ ${result.message}`);
      if (result.remediation) {
        console.error(`  ${result.remediation}`);
      }
    });
    process.exit(1);
  }

  if (!mode) {
    mode = (await promptChoice('Select installation mode:', ['managed', 'self-hosted'])) as
      | 'managed'
      | 'self-hosted';
  }

  if (!profile) {
    profile = (await promptChoice('Select installation profile:', ['core', 'full'])) as
      | 'core'
      | 'full';
  }

  await displayProfileDetails(profile);

  const plan = planner.createPlan({ mode, profile, apiUrl });
  const installDir = plan.installDir;
  fs.mkdirSync(installDir, { recursive: true, mode: 0o700 });

  let manifest: InstallManifest;
  let identity = credentialManager.loadIdentity();

  if (mode === 'managed') {
    const result = await enrollmentFlow({ apiUrl, profile });
    manifest = result.manifest;
    identity = result.identity;
  } else {
    manifest = await bootstrapFlow();
  }

  manifest.profile = profile;
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

  console.log(`✓ Installation assets written to ${installDir}`);
  if (mode === 'self-hosted') {
    console.log('Open http://127.0.0.1:3000 to complete bootstrap.');
  }
}
