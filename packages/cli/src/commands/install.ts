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
import { isCancel, select, spinner } from '@clack/prompts';
import { resolveManifest } from '../manifest.js';
import { doctor } from './doctor.js';
import { installViaSSH } from '../ssh.js';
import type { SetupManifest } from '../sdk.js';
import type { NodeIdentity } from '../types/runtime.js';
import { resolveDemoDataPreference } from '../demo-data.js';
import { resolveCliPaths } from '../storage/paths.js';
import { StateManager } from '../managers/state-manager.js';
import { resolvePublishedImageManifest } from '../services/image-manifest.js';
import {
  buildHealthTimeoutMessage,
  collectDockerComposeDiagnostics,
  persistDockerComposeDiagnostics,
} from '../services/install-diagnostics.js';
import { CLI_VERSION } from '../version.js';

// ---------------------------------------------------------------------------
// Inline infra helpers (mirrors packages/infra/src/compose.ts and install.ts)
// These are inlined to avoid a cross-package dependency that isn't yet wired.
// ---------------------------------------------------------------------------

function resolveInstallDir(): string {
  return process.env['CIG_INSTALL_DIR'] ?? resolveCliPaths().installDir;
}

const SELF_HOSTED_SQLITE_URL = 'sqlite:///var/lib/cig-node/cig.db';
const SELF_HOSTED_CHROMA_URL = 'http://chroma:8000';
const SELF_HOSTED_OLLAMA_BASE_URL = 'http://ollama:11434/v1';
const SELF_HOSTED_OLLAMA_CHAT_MODEL = 'llama3.2:3b';
const SELF_HOSTED_OLLAMA_EMBEDDING_MODEL = 'nomic-embed-text-v2-moe';
const SELF_HOSTED_GEMMA_CHAT_MODEL = 'gemma2:2b';
const OPENAI_CHAT_MODEL_DEFAULT = 'gpt-4o-mini';
const OPENAI_EMBEDDING_MODEL_DEFAULT = 'text-embedding-3-small';

export type SelfHostedInferenceChoice = 'ollama' | 'gemma' | 'openai';

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function resolveSelfHostedInferenceChoice(
  explicitChoice?: SelfHostedInferenceChoice,
  defaultChoice: SelfHostedInferenceChoice = 'ollama'
): Promise<SelfHostedInferenceChoice> {
  if (explicitChoice) {
    return explicitChoice;
  }

  if (!isInteractiveTerminal()) {
    return defaultChoice;
  }

  const result = await select({
    message: 'Choose self-hosted inference:',
    options: [
      { value: 'ollama', label: 'Ollama (recommended)' },
      { value: 'gemma', label: 'Gemma via Ollama' },
      { value: 'openai', label: 'OpenAI later (add API key in .env)' },
    ],
  });

  if (isCancel(result)) {
    throw new Error('Installation was cancelled.');
  }

  return result as SelfHostedInferenceChoice;
}

function resolveSelfHostedInferenceEnv(choice: SelfHostedInferenceChoice): string[] {
  if (choice === 'openai') {
    return [
      '# Self-hosted inference configuration',
      'CIG_INFERENCE_PROVIDER=openai',
      '# Set OPENAI_API_KEY later in this file or your shell environment',
      'OPENAI_API_KEY=',
      `OPENAI_CHAT_MODEL=${OPENAI_CHAT_MODEL_DEFAULT}`,
      `OPENAI_EMBEDDING_MODEL=${OPENAI_EMBEDDING_MODEL_DEFAULT}`,
      '',
    ];
  }

  return [
    '# Self-hosted inference configuration',
    'CIG_INFERENCE_PROVIDER=ollama',
    `OLLAMA_BASE_URL=${SELF_HOSTED_OLLAMA_BASE_URL}`,
    `OLLAMA_CHAT_MODEL=${choice === 'gemma' ? SELF_HOSTED_GEMMA_CHAT_MODEL : SELF_HOSTED_OLLAMA_CHAT_MODEL}`,
    `OLLAMA_EMBEDDING_MODEL=${SELF_HOSTED_OLLAMA_EMBEDDING_MODEL}`,
    '',
  ];
}

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
async function writeBootstrapToken(token: string, installDir: string): Promise<void> {
  const tokenFile = path.join(installDir, '.bootstrap-token');
  fs.mkdirSync(path.dirname(tokenFile), { recursive: true, mode: 0o700 });
  fs.writeFileSync(tokenFile, token, { mode: 0o600, encoding: 'utf8' });
}

/**
 * Generate a docker-compose.yml string from a SetupManifest and install profile.
 * Mirrors packages/infra/src/compose.ts generateComposeFile().
 *
 * Requirements: 5.9, 6.1
 */
function generateComposeFile(
  manifest: SetupManifest,
  profile: 'core' | 'discovery' | 'full',
  serviceImages: Record<string, string> = {}
): string {
  const selfHosted = manifest.targetMode === 'host';

  const img = (service: string, fallback: string): string =>
    serviceImages[service] ?? `docker.io/cigtechnology/${fallback}`;

  const neo4jImage = serviceImages['neo4j'] ?? 'neo4j:5';

  const coreServices = `\
  discovery:
    image: ${img('discovery', 'cig-discovery:latest')}
    restart: unless-stopped
    environment:
      - CIG_CLOUD_PROVIDER=\${CIG_CLOUD_PROVIDER}
      - AWS_ROLE_ARN=\${AWS_ROLE_ARN:-}
      - AWS_EXTERNAL_ID=\${AWS_EXTERNAL_ID:-}
      - GCP_PROJECT_ID=\${GCP_PROJECT_ID:-}
      - GCP_SA_EMAIL=\${GCP_SA_EMAIL:-}
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_PASSWORD=\${NEO4J_PASSWORD}

  cartography:
    image: ${img('cartography', 'cig-cartography:latest')}
    restart: unless-stopped
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_PASSWORD=\${NEO4J_PASSWORD}
    depends_on:
      - neo4j

  neo4j:
    image: ${neo4jImage}
    restart: unless-stopped
    volumes:
      - neo4j-data:/data
    environment:
      - NEO4J_AUTH=neo4j/\${NEO4J_PASSWORD}`;

  let services = coreServices;

  if (profile === 'full') {
    services += `

  chatbot:
    image: ${img('chatbot', 'cig-chatbot:latest')}
    restart: unless-stopped
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_PASSWORD=\${NEO4J_PASSWORD}
      - CIG_CONTROL_PLANE=\${CIG_CONTROL_PLANE_ENDPOINT}
      - CIG_INFERENCE_PROVIDER=\${CIG_INFERENCE_PROVIDER:-}
      - OLLAMA_BASE_URL=\${OLLAMA_BASE_URL:-}
      - OLLAMA_CHAT_MODEL=\${OLLAMA_CHAT_MODEL:-llama3.2:3b}
      - OLLAMA_EMBEDDING_MODEL=\${OLLAMA_EMBEDDING_MODEL:-nomic-embed-text-v2-moe}`;
  }

  if (selfHosted) {
    services += `

  ollama:
    image: ollama/ollama:latest
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama

  chroma:
    image: chromadb/chroma:0.5.0
    restart: unless-stopped
    ports:
      - "8000:8000"
    volumes:
      - chroma-data:/chroma/chroma
    environment:
      - IS_PERSISTENT=TRUE
      - ANONYMIZED_TELEMETRY=FALSE

  api:
    image: ${img('api', 'cig-api:latest')}
    restart: unless-stopped
    ports:
      - "3003:3003"
    volumes:
      - api-data:/var/lib/cig-node
    environment:
      - PORT=3003
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_PASSWORD=\${NEO4J_PASSWORD}
      - DATABASE_URL=\${DATABASE_URL:-${SELF_HOSTED_SQLITE_URL}}
      - CHROMA_URL=\${CHROMA_URL:-${SELF_HOSTED_CHROMA_URL}}
      - CIG_INFERENCE_PROVIDER=\${CIG_INFERENCE_PROVIDER:-ollama}
      - OLLAMA_BASE_URL=\${OLLAMA_BASE_URL:-${SELF_HOSTED_OLLAMA_BASE_URL}}
      - OLLAMA_CHAT_MODEL=\${OLLAMA_CHAT_MODEL:-${SELF_HOSTED_OLLAMA_CHAT_MODEL}}
      - OLLAMA_EMBEDDING_MODEL=\${OLLAMA_EMBEDDING_MODEL:-${SELF_HOSTED_OLLAMA_EMBEDDING_MODEL}}
      - CIG_DEMO_MODE=\${CIG_DEMO_MODE:-false}
      - CIG_AUTH_MODE=self-hosted
      - CIG_AUTO_MIGRATE=\${CIG_AUTO_MIGRATE:-true}
      - CORS_ORIGINS=http://localhost:3000
    depends_on:
      - neo4j
      - chroma

  dashboard:
    image: ${img('dashboard-selfhosted', 'cig-dashboard-selfhosted:latest')}
    restart: unless-stopped
    ports:
      - "3000:3000"
    depends_on:
      - api`;
  }

  if (manifest.isDemo) {
    services = injectDemoMockDbMount(services);
  }

  const volumes: string[] = ['  neo4j-data:'];
  if (selfHosted) {
    volumes.push('  api-data:');
    volumes.push('  chroma-data:');
    volumes.push('  ollama-data:');
  }

  return [
    'services:',
    services,
    '',
    'volumes:',
    volumes.join('\n'),
    '',
  ].join('\n');
}

function injectDemoMockDbMount(services: string): string {
  return services.replace(
    /(  cartography:\n[\s\S]*?    environment:\n[\s\S]*?      - NEO4J_PASSWORD=\$\{NEO4J_PASSWORD\}\n)/,
    '$1    volumes:\n      - ./mock-dbs:/opt/cig-node/mock-dbs:ro\n'
  );
}

/**
 * Generate a .env file string from a SetupManifest and NodeIdentity.
 * Mirrors packages/infra/src/compose.ts generateEnvFile().
 *
 * Requirements: 5.9, 6.2
 */
function generateEnvFile(
  manifest: SetupManifest,
  nodeIdentity: NodeIdentity,
  selfHostedInference: SelfHostedInferenceChoice = 'ollama'
): string {
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

  if (manifest.targetMode === 'host') {
    lines.push('# Self-hosted local database configuration');
    lines.push('CIG_AUTH_MODE=self-hosted');
    lines.push(`DATABASE_URL=${SELF_HOSTED_SQLITE_URL}`);
    lines.push(`CHROMA_URL=${SELF_HOSTED_CHROMA_URL}`);
    lines.push(...resolveSelfHostedInferenceEnv(selfHostedInference));
    lines.push('CIG_AUTO_MIGRATE=true');
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
  inference?: SelfHostedInferenceChoice;
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

const HEALTH_POLL_INTERVAL_MS = 3_000;
const HEALTH_POLL_TIMEOUT_MS = 120_000; // 2 minutes
const SELF_HOSTED_HEALTH_POLL_TIMEOUT_MS = 300_000; // 5 minutes

/**
 * Poll the node-runtime health endpoint until it responds 200 or timeout.
 * Returns true if healthy within the timeout, false otherwise.
 *
 * Requirement 5.10 — CLI exits after confirming node is healthy
 */
async function pollNodeHealth(
  timeoutMs = HEALTH_POLL_TIMEOUT_MS
): Promise<boolean> {
  // Poll the API health endpoint on the local host.
  const healthUrl = 'http://127.0.0.1:3003/api/v1/health';
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

function captureInstallDiagnostics(installDir: string): string | null {
  try {
    const diagnostics = collectDockerComposeDiagnostics(installDir);
    return persistDockerComposeDiagnostics(installDir, diagnostics);
  } catch {
    return null;
  }
}

async function pullOllamaModels(
  installDir: string,
  inferenceChoice: SelfHostedInferenceChoice = 'ollama'
): Promise<void> {
  if (inferenceChoice === 'openai') {
    return;
  }

  const models = [
    inferenceChoice === 'gemma' ? SELF_HOSTED_GEMMA_CHAT_MODEL : SELF_HOSTED_OLLAMA_CHAT_MODEL,
    SELF_HOSTED_OLLAMA_EMBEDDING_MODEL,
  ];
  const maxAttempts = 20;
  const retryDelayMs = 5_000;

  for (const model of models) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const s = spinner();
      s.start(`Pulling Ollama model ${model}…`);
      try {
        execSync(`docker compose exec -T ollama ollama pull ${model}`, {
          cwd: installDir,
          stdio: 'inherit',
        });
        s.stop(`Ollama model ${model} is ready.`);
        break;
      } catch (error) {
        s.stop(`Waiting for Ollama model ${model}…`);
        if (attempt >= maxAttempts) {
          throw error instanceof Error
            ? error
            : new Error(`Failed to pull Ollama model ${model}: ${String(error)}`);
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }
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
  demo?: boolean,
  inference?: SelfHostedInferenceChoice
): Promise<void> {
  // Normalise arguments — support both legacy positional call and new options object
  let opts: InstallOptions;

  if (typeof apiUrlOrOptions === 'object' && apiUrlOrOptions !== null) {
    opts = apiUrlOrOptions;
  } else {
    opts = {
      apiUrl: typeof apiUrlOrOptions === 'string' ? apiUrlOrOptions : 'http://localhost:3003',
      mode: mode ?? 'managed',
      profile: profile ?? 'core',
      target: 'local',
      demo,
      inference,
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
    apiUrl = 'http://localhost:3003',
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

  const selfHostedInference =
    mode === 'self-hosted' ? await resolveSelfHostedInferenceChoice(opts.inference) : undefined;

  // -------------------------------------------------------------------------
  // Step 2 — Run doctor prerequisite checks (Requirements 5.7, 5.8)
  // -------------------------------------------------------------------------

  console.log('\nRunning prerequisite checks…');
  await doctor({
    target,
    sshHost,
    sshKeyPath,
    // For managed mode, verify reachability to the remote control plane before
    // installing.  For self-hosted, the API hasn't started yet so skip the
    // network check — docker/compose availability is enough to proceed.
    controlPlaneUrl: manifest?.controlPlaneEndpoint,
    skipNetworkCheck: !manifest,
  });

  // -------------------------------------------------------------------------
  // Step 3 — Generate compose + env files (Requirement 5.9)
  // -------------------------------------------------------------------------

  // For self-hosted mode without a manifest, build a synthetic manifest
  const effectiveManifest: SetupManifest = manifest ?? buildSelfHostedManifest(apiUrl, profile, demo);
  effectiveManifest.isDemo = demo;

  const effectiveProfile = manifest?.installProfile ?? profile;

  // Resolve pinned image digests from the published release manifest.
  // Fall back to Docker Hub :latest tags if the release asset is unavailable.
  let serviceImages: Record<string, string> = {};
  try {
    const s = spinner();
    s.start('Resolving published image manifest…');
    const imageManifest = await resolvePublishedImageManifest(CLI_VERSION);
    serviceImages = imageManifest.images;
    s.stop('Image manifest resolved.');
  } catch {
    console.warn('  Warning: could not resolve pinned image manifest — falling back to :latest tags.');
  }

  const composeContent = generateComposeFile(effectiveManifest, effectiveProfile, serviceImages);

  // Build a stub identity for env generation — real identity comes after enrollment
  const stubIdentity = buildStubNodeIdentity();
  const envContent = generateEnvFile(
    effectiveManifest,
    stubIdentity,
    selfHostedInference ?? 'ollama'
  );

  // -------------------------------------------------------------------------
  // Step 4 — Write files to install dir (Requirements 5.9, 6.1)
  // -------------------------------------------------------------------------

  const installDir = resolveInstallDir();

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
    await writeBootstrapToken(bootstrapToken, installDir);
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
        installDir,
        mode === 'self-hosted' && selfHostedInference !== 'openai'
          ? [
              `docker compose exec -T ollama ollama pull ${selfHostedInference === 'gemma' ? SELF_HOSTED_GEMMA_CHAT_MODEL : SELF_HOSTED_OLLAMA_CHAT_MODEL}`,
              `docker compose exec -T ollama ollama pull ${SELF_HOSTED_OLLAMA_EMBEDDING_MODEL}`,
            ]
          : []
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
      if (mode === 'self-hosted' && selfHostedInference !== 'openai') {
        await pullOllamaModels(installDir, selfHostedInference);
      }
      s.stop('CIG Node runtime started.');
    } catch (err) {
      s.stop('docker compose up failed.');
      const diagnosticsPath = captureInstallDiagnostics(installDir);
      await rollback(installDir);
      const diagnosticsNote = diagnosticsPath
        ? `Recent Docker Compose diagnostics were saved to ${diagnosticsPath}. `
        : '';
      const followUpNote = diagnosticsPath
        ? `The stack at ${installDir} was rolled back after the failure, so inspect that file for the failure details.`
        : `The stack at ${installDir} was rolled back after the failure.`;
      throw new Error(
        `docker compose up -d failed: ${err instanceof Error ? err.message : String(err)}. ` +
          diagnosticsNote +
          followUpNote
      );
    }
  }

  // -------------------------------------------------------------------------
  // Step 7 — Poll node health until healthy or timeout (Requirement 5.10)
  // -------------------------------------------------------------------------

  const healthSpinner = spinner();
  healthSpinner.start('Waiting for CIG Node to become healthy…');
  const healthTimeoutMs =
    mode === 'self-hosted' ? SELF_HOSTED_HEALTH_POLL_TIMEOUT_MS : HEALTH_POLL_TIMEOUT_MS;
  const healthy = await pollNodeHealth(healthTimeoutMs);

  if (!healthy) {
    healthSpinner.stop('Health check timed out. Collecting Docker Compose diagnostics…');
    const diagnosticsPath = captureInstallDiagnostics(installDir);
    await rollback(installDir);
    throw new Error(buildHealthTimeoutMessage(installDir, healthTimeoutMs, diagnosticsPath));
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

  await new StateManager().save({
    version: '1.0',
    mode,
    profile: effectiveProfile as 'core' | 'discovery' | 'full',
    installDir,
    installedAt: new Date().toISOString(),
    status: 'running',
    services: [],
  });

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
    cloudProvider: 'aws' as any, // self-hosted does not use Supabase/managed cloud creds
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
