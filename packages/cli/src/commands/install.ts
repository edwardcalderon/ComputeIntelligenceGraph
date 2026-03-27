/**
 * `cig install` — CIG Node Runtime Installation
 *
 * Orchestrates the full install flow:
 *   1. Fetch and verify the Setup_Manifest (signature + expiry)
 *   2. Run doctor prerequisite checks (docker, docker-compose, network)
 *   3. Generate docker-compose.yml and .env from the manifest
 *   4. Write files to INSTALL_DIR (/opt/cig-node)
 *   5. Run `docker compose up -d` (locally or via SSH for --target ssh)
 *   6. Poll node health endpoint until healthy or timeout
 *   7. Exit 0 on success, non-zero on failure
 *
 * For --mode self-hosted: installs full CIG control plane stack, generates
 * a Bootstrap_Token, writes it to the install dir, and displays it once.
 *
 * The CLI exits after confirming the node is healthy — it is NOT the
 * discovery engine.
 *
 * Requirements: 5.1–5.10, 4.3, 13.1, 13.2
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import { spinner } from '@clack/prompts';
import { resolveManifest } from '../manifest.js';
import { doctor } from './doctor.js';
import { installViaSSH } from '../ssh.js';
import type { SetupManifest } from '../sdk.js';
import type { NodeIdentity } from '../types/runtime.js';
import { resolveDemoDataPreference } from '../demo-data.js';

// ---------------------------------------------------------------------------
// Inline infra helpers (mirrors packages/infra/src/compose.ts and install.ts)
// These are inlined to avoid a cross-package dependency that isn't yet wired.
// ---------------------------------------------------------------------------

const INSTALL_DIR = '/opt/cig-node';

/**
 * Generate a cryptographically random 32-character bootstrap token.
 * Mirrors packages/infra/src/install.ts generateBootstrapToken().
 */
function generateBootstrapToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Write the bootstrap token to the install directory with 0600 permissions.
 * Mirrors packages/infra/src/install.ts writeBootstrapToken().
 */
async function writeBootstrapToken(token: string): Promise<void> {
  const tokenFile = path.join(INSTALL_DIR, '.bootstrap-token');
  fs.mkdirSync(path.dirname(tokenFile), { recursive: true, mode: 0o700 });
  fs.writeFileSync(tokenFile, token, { mode: 0o600, encoding: 'utf8' });
}

/**
 * Generate a docker-compose.yml string from a SetupManifest and install profile.
 * Mirrors packages/infra/src/compose.ts generateComposeFile().
 *
 * Requirements: 5.9, 6.1
 */
function generateComposeFile(manifest: SetupManifest, profile: 'core' | 'discovery' | 'full'): string {
  const selfHosted = manifest.targetMode === 'host';

  const coreServices = `\
  node-runtime:
    image: ghcr.io/cig/node-runtime:\${CIG_VERSION}
    restart: unless-stopped
    volumes:
      - ./identity:/opt/cig-node/identity:ro
      - ./config:/opt/cig-node/config:ro
    environment:
      - CIG_NODE_ID=\${CIG_NODE_ID}
      - CIG_CONTROL_PLANE=\${CIG_CONTROL_PLANE_ENDPOINT}
      - CIG_CLOUD_PROVIDER=\${CIG_CLOUD_PROVIDER}
    depends_on:
      - discovery-worker
      - graph-writer

  discovery-worker:
    image: ghcr.io/cig/discovery-worker:\${CIG_VERSION}
    restart: unless-stopped
    environment:
      - CIG_CLOUD_PROVIDER=\${CIG_CLOUD_PROVIDER}
      - AWS_ROLE_ARN=\${AWS_ROLE_ARN}
      - AWS_EXTERNAL_ID=\${AWS_EXTERNAL_ID}
      - GCP_PROJECT_ID=\${GCP_PROJECT_ID}
      - GCP_SA_EMAIL=\${GCP_SA_EMAIL}

  cartography:
    image: ghcr.io/cig/cartography:\${CIG_VERSION}
    restart: unless-stopped
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_PASSWORD=\${NEO4J_PASSWORD}

  graph-writer:
    image: ghcr.io/cig/graph-writer:\${CIG_VERSION}
    restart: unless-stopped
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_PASSWORD=\${NEO4J_PASSWORD}
      - CIG_CONTROL_PLANE=\${CIG_CONTROL_PLANE_ENDPOINT}

  neo4j:
    image: neo4j:5
    restart: unless-stopped
    volumes:
      - neo4j-data:/data
    environment:
      - NEO4J_AUTH=neo4j/\${NEO4J_PASSWORD}`;

  let services = coreServices;

  if (profile === 'full') {
    services += `
  chatbot:
    image: ghcr.io/cig/chatbot:\${CIG_VERSION}
    restart: unless-stopped
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_PASSWORD=\${NEO4J_PASSWORD}
      - CIG_CONTROL_PLANE=\${CIG_CONTROL_PLANE_ENDPOINT}

  chroma:
    image: ghcr.io/cig/chroma:\${CIG_VERSION}
    restart: unless-stopped
    volumes:
      - chroma-data:/chroma/chroma

  agents:
    image: ghcr.io/cig/agents:\${CIG_VERSION}
    restart: unless-stopped
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_PASSWORD=\${NEO4J_PASSWORD}
      - CHROMA_URI=http://chroma:8000
      - CIG_CONTROL_PLANE=\${CIG_CONTROL_PLANE_ENDPOINT}`;
  }

  if (selfHosted) {
    services += `
  api:
    image: ghcr.io/cig/api:\${CIG_VERSION}
    restart: unless-stopped
    ports:
      - "3003:3003"
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_PASSWORD=\${NEO4J_PASSWORD}
      - DATABASE_URL=\${DATABASE_URL}
      - CHROMA_URI=http://chroma:8000
    depends_on:
      - neo4j

  dashboard:
    image: ghcr.io/cig/dashboard:\${CIG_VERSION}
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3003
    depends_on:
      - api`;
  }
  if (manifest.isDemo) {
    // Inject mock-dbs mount into discovery-worker and graph-writer
    services = services.replace(
      '    depends_on:',
      '    volumes:\n      - ./mock-dbs:/opt/cig-node/mock-dbs:ro\n    depends_on:'
    );
  }

  const volumes: string[] = ['  neo4j-data:'];
  if (profile === 'full') volumes.push('  chroma-data:');
  if (selfHosted) volumes.push('  postgres-data:');

  return [
    "version: '3.8'",
    'services:',
    services,
    '',
    'volumes:',
    volumes.join('\n'),
    '',
  ].join('\n');
}

/**
 * Generate a .env file string from a SetupManifest and NodeIdentity.
 * Mirrors packages/infra/src/compose.ts generateEnvFile().
 *
 * Requirements: 5.9, 6.2
 */
function generateEnvFile(manifest: SetupManifest, nodeIdentity: NodeIdentity): string {
  const lines: string[] = [
    '# Generated by CIG CLI — do not edit manually',
    `# Generated at: ${new Date().toISOString()}`,
    '',
    '# Node identity',
    `CIG_NODE_ID=${nodeIdentity.nodeId}`,
    '',
    '# Control plane',
    `CIG_CONTROL_PLANE_ENDPOINT=${manifest.controlPlaneEndpoint}`,
    '',
    '# Cloud provider',
    `CIG_CLOUD_PROVIDER=${manifest.cloudProvider}`,
    '',
    '# Image version',
    'CIG_VERSION=latest',
    '',
    '# Neo4j credentials (auto-generated)',
    `NEO4J_PASSWORD=${crypto.randomBytes(16).toString('hex')}`,
    '',
  ];

  if (manifest.isDemo) {
    lines.push('# Demo mode configuration');
    lines.push('CIG_DEMO_MODE=true');
    lines.push('CIG_CLOUD_PROVIDER=mock');
    lines.push('');
  }

  if (manifest.cloudProvider === 'aws' && manifest.awsConfig) {
    lines.push('# AWS configuration');
    lines.push(`AWS_ROLE_ARN=${manifest.awsConfig.roleArn}`);
    lines.push(`AWS_EXTERNAL_ID=${manifest.awsConfig.externalId}`);
    lines.push(`AWS_REGION=${manifest.awsConfig.region}`);
    lines.push('');
    lines.push('GCP_PROJECT_ID=');
    lines.push('GCP_SA_EMAIL=');
    lines.push('');
  } else if (manifest.cloudProvider === 'gcp' && manifest.gcpConfig) {
    lines.push('# GCP configuration');
    lines.push(`GCP_PROJECT_ID=${manifest.gcpConfig.projectId}`);
    lines.push(`GCP_SA_EMAIL=${manifest.gcpConfig.serviceAccountEmail}`);
    lines.push('');
    lines.push('AWS_ROLE_ARN=');
    lines.push('AWS_EXTERNAL_ID=');
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstallOptions {
  /** URL or base64-encoded SetupManifest */
  manifest?: string;
  mode: 'managed' | 'self-hosted';
  cloud?: 'aws' | 'gcp';
  profile: 'core' | 'discovery' | 'full';
  target: 'local' | 'ssh' | 'host';
  apiUrl?: string;
  /** SSH options (required when --target ssh) */
  sshHost?: string;
  sshUser?: string;
  sshKeyPath?: string;
  sshPort?: number;
  /** Whether to provision with demo/mock data */
  demo?: boolean;
}

// ---------------------------------------------------------------------------
// Health polling
// ---------------------------------------------------------------------------

const HEALTH_POLL_INTERVAL_MS = 5_000;
const HEALTH_POLL_TIMEOUT_MS = 300_000; // 5 minutes

/**
 * Poll the node-runtime health endpoint until it responds 200 or timeout.
 * Returns true if healthy within the timeout, false otherwise.
 *
 * Requirement 5.10 — CLI exits after confirming node is healthy
 */
async function pollNodeHealth(
  timeoutMs = HEALTH_POLL_TIMEOUT_MS
): Promise<boolean> {
  // Poll the node-runtime health endpoint on the local host.
  const healthUrl = 'http://127.0.0.1:8080/health';
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(4_000) });
      if (response.ok) {
        return true;
      }
    } catch {
      // Not yet healthy — keep polling
    }

    await new Promise<void>((resolve) => setTimeout(resolve, HEALTH_POLL_INTERVAL_MS));
  }

  return false;
}

// ---------------------------------------------------------------------------
// Local docker compose up
// ---------------------------------------------------------------------------

/**
 * Run `docker compose up -d` in the given directory.
 * Throws on non-zero exit.
 *
 * Requirement 5.9
 */
function dockerComposeUp(installDir: string): void {
  execSync('docker compose up -d', { cwd: installDir, stdio: 'inherit' });
}

// ---------------------------------------------------------------------------
// Write compose + env files to install dir
// ---------------------------------------------------------------------------

/**
 * Write docker-compose.yml and .env to the install directory.
 * Creates the directory (mode 0700) if it does not exist.
 *
 * Requirements: 5.9, 6.1
 */
function writeInstallFiles(
  installDir: string,
  composeContent: string,
  envContent: string
): { composePath: string; envPath: string } {
  fs.mkdirSync(installDir, { recursive: true, mode: 0o700 });

  const composePath = path.join(installDir, 'docker-compose.yml');
  const envPath = path.join(installDir, '.env');

  fs.writeFileSync(composePath, composeContent, { encoding: 'utf8', mode: 0o600 });
  fs.writeFileSync(envPath, envContent, { encoding: 'utf8', mode: 0o600 });

  return { composePath, envPath };
}

// ---------------------------------------------------------------------------
// Rollback helper
// ---------------------------------------------------------------------------

async function rollback(installDir: string): Promise<void> {
  try {
    execSync('docker compose down', { cwd: installDir, stdio: 'pipe' });
  } catch {
    // Best-effort only
  }

  for (const fileName of ['docker-compose.yml', '.env']) {
    const filePath = path.join(installDir, fileName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Best-effort only
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Build a stub NodeIdentity for env file generation when no enrollment yet
// ---------------------------------------------------------------------------

function buildStubNodeIdentity(): NodeIdentity {
  return {
    nodeId: 'pending-enrollment',
    privateKey: '',
    publicKey: '',
    enrolledAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Legacy-compatible overload: called from index.ts with positional args.
 * Delegates to the full InstallOptions path.
 */
export async function install(
  apiUrlOrOptions?: string | InstallOptions,
  mode?: 'managed' | 'self-hosted',
  profile?: 'core' | 'discovery' | 'full',
  demo?: boolean
): Promise<void> {
  // Normalise arguments — support both legacy positional call and new options object
  let opts: InstallOptions;

  if (typeof apiUrlOrOptions === 'object' && apiUrlOrOptions !== null) {
    opts = apiUrlOrOptions;
  } else {
    opts = {
      apiUrl: typeof apiUrlOrOptions === 'string' ? apiUrlOrOptions : 'http://localhost:8000',
      mode: mode ?? 'managed',
      profile: profile ?? 'core',
      target: 'local',
      demo,
    };
  }

  await runInstall(opts);
}

// ---------------------------------------------------------------------------
// Core install orchestration
// ---------------------------------------------------------------------------

async function runInstall(opts: InstallOptions): Promise<void> {
  const {
    mode,
    profile,
    target,
    apiUrl = 'http://localhost:8000',
    sshHost,
    sshUser = 'root',
    sshKeyPath,
    sshPort = 22,
  } = opts;

  // -------------------------------------------------------------------------
  // Step 1 — Fetch and verify the Setup_Manifest (Requirements 5.1, 5.2)
  // -------------------------------------------------------------------------

  let manifest: SetupManifest | undefined;

  if (opts.manifest) {
    const s = spinner();
    s.start('Fetching and verifying Setup_Manifest…');
    try {
      manifest = await resolveManifest(opts.manifest);
      s.stop('Setup_Manifest verified.');
    } catch (err) {
      s.stop('Manifest verification failed.');
      // Requirement 5.2 — abort with clear error, write nothing to disk
      throw new Error(
        `Manifest error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  } else if (mode !== 'self-hosted') {
    // Managed mode requires a manifest
    throw new Error(
      'A Setup_Manifest is required for managed mode. Use --manifest <url-or-base64>.'
    );
  }

  const demo = await resolveDemoDataPreference({
    explicitDemo: opts.demo,
    defaultValue: Boolean(manifest?.isDemo),
    message: 'Include demo data in this installation?',
  });

  // -------------------------------------------------------------------------
  // Step 2 — Run doctor prerequisite checks (Requirements 5.7, 5.8)
  // -------------------------------------------------------------------------

  console.log('\nRunning prerequisite checks…');
  await doctor({
    target,
    sshHost,
    sshKeyPath,
    controlPlaneUrl: manifest?.controlPlaneEndpoint ?? apiUrl,
  });

  // -------------------------------------------------------------------------
  // Step 3 — Generate compose + env files (Requirement 5.9)
  // -------------------------------------------------------------------------

  // For self-hosted mode without a manifest, build a synthetic manifest
  const effectiveManifest: SetupManifest = manifest ?? buildSelfHostedManifest(apiUrl, profile, demo);
  effectiveManifest.isDemo = demo;

  const effectiveProfile = manifest?.installProfile ?? profile;
  const composeContent = generateComposeFile(effectiveManifest, effectiveProfile);

  // Build a stub identity for env generation — real identity comes after enrollment
  const stubIdentity = buildStubNodeIdentity();
  const envContent = generateEnvFile(effectiveManifest, stubIdentity);

  // -------------------------------------------------------------------------
  // Step 4 — Write files to install dir (Requirements 5.9, 6.1)
  // -------------------------------------------------------------------------

  const installDir = INSTALL_DIR;

  // Demo mode: Copy mock DBs
  if (demo) {
    const assetsSrc = path.join(process.cwd(), 'assets', 'mock-dbs');
    const assetsDest = path.join(installDir, 'mock-dbs');
    if (fs.existsSync(assetsSrc)) {
      fs.mkdirSync(assetsDest, { recursive: true });
      fs.readdirSync(assetsSrc).forEach((file) => {
        fs.copyFileSync(path.join(assetsSrc, file), path.join(assetsDest, file));
      });
      console.log(`✓ Demo assets copied to ${assetsDest}`);
    }
  }

  const { composePath, envPath } = writeInstallFiles(installDir, composeContent, envContent);
  console.log(`\n✓ Install files written to ${installDir}`);

  // -------------------------------------------------------------------------
  // Step 5 — Self-hosted: generate and display Bootstrap_Token (Req 13.2)
  // -------------------------------------------------------------------------

  let bootstrapToken: string | undefined;
  if (mode === 'self-hosted') {
    bootstrapToken = generateBootstrapToken();
    await writeBootstrapToken(bootstrapToken);
  }

  // -------------------------------------------------------------------------
  // Step 6 — Run `docker compose up -d` (local or via SSH) (Req 5.3, 5.4)
  // -------------------------------------------------------------------------

  if (target === 'ssh') {
    // Requirement 5.4 — SSH install
    if (!sshHost) {
      throw new Error('--ssh-host is required when --target ssh is set.');
    }

    const s = spinner();
    s.start(`Installing CIG Node on ${sshHost} via SSH…`);
    try {
      await installViaSSH(
        { host: sshHost, user: sshUser, keyPath: sshKeyPath, port: sshPort },
        composePath,
        envPath,
        installDir
      );
      s.stop(`CIG Node installed on ${sshHost}.`);
    } catch (err) {
      s.stop('SSH installation failed.');
      await rollback(installDir);
      throw new Error(
        `SSH installation failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  } else {
    // target === 'local' or target === 'host' — install locally (Req 5.3, 5.6)
    const s = spinner();
    s.start('Starting CIG Node runtime…');
    try {
      dockerComposeUp(installDir);
      s.stop('CIG Node runtime started.');
    } catch (err) {
      s.stop('docker compose up failed.');
      await rollback(installDir);
      throw new Error(
        `docker compose up -d failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // -------------------------------------------------------------------------
  // Step 7 — Poll node health until healthy or timeout (Requirement 5.10)
  // -------------------------------------------------------------------------

  const healthSpinner = spinner();
  healthSpinner.start('Waiting for CIG Node to become healthy…');
  const healthy = await pollNodeHealth();

  if (!healthy) {
    healthSpinner.stop('Health check timed out.');
    await rollback(installDir);
    throw new Error(
      'Timed out waiting for CIG Node to become healthy. ' +
        'Check `docker compose logs` in ' + installDir + ' for details.'
    );
  }

  healthSpinner.stop('CIG Node is healthy.');

  // -------------------------------------------------------------------------
  // Step 8 — Display Bootstrap_Token for self-hosted (shown once) (Req 13.2)
  // -------------------------------------------------------------------------

  if (mode === 'self-hosted' && bootstrapToken) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Bootstrap Token (shown once — save it now):');
    console.log(`\n  ${bootstrapToken}\n`);
    console.log('Open http://localhost:3000 to complete the self-hosted bootstrap.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  // -------------------------------------------------------------------------
  // Done — CLI exits (Requirement 5.10)
  // -------------------------------------------------------------------------

  console.log('✓ CIG Node installation complete.');
  if (manifest) {
    console.log(`  Node will enroll with control plane at ${manifest.controlPlaneEndpoint}`);
  }
}

// ---------------------------------------------------------------------------
// Build a synthetic SetupManifest for self-hosted mode (no --manifest flag)
// ---------------------------------------------------------------------------

function buildSelfHostedManifest(
  apiUrl: string,
  profile: 'core' | 'discovery' | 'full',
  isDemo?: boolean
): SetupManifest {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

  return {
    version: '1.0',
    cloudProvider: isDemo ? 'mock' : ('aws' as any), // placeholder — self-hosted doesn't require cloud creds at install time
    credentialsRef: '',
    enrollmentToken: '',
    nodeIdentitySeed: '',
    installProfile: profile,
    targetMode: 'host',
    controlPlaneEndpoint: apiUrl,
    signature: '',
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    isDemo,
  };
}
