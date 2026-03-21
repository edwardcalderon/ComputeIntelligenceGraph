/**
 * Install Command — CIG Installation Orchestration
 *
 * Orchestrates the complete installation flow:
 * 1. Run prerequisite checks
 * 2. Prompt for mode (managed/self-hosted) if not provided
 * 3. Branch to enrollment flow (managed) or bootstrap flow (self-hosted)
 * 4. Prompt for profile (core/full) if not provided
 * 5. Generate compose files
 * 6. Start services with docker compose up -d
 * 7. Poll health endpoints until all pass or 5-minute timeout
 * 8. Write installation state to ~/.cig/state.json
 * 9. Display success message with Dashboard URL
 *
 * Requirements 4, 5, 6, 7: CLI Install Flow
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { promisify } from 'util';
import * as readline from 'readline';

import { runAllChecks } from '../prereqs.js';
import { generateCompose, InstallManifest } from '../compose-generator.js';
import { CredentialManager } from '../credentials.js';
import { enrollmentFlow } from './enrollment.js';
import { bootstrapFlow } from './bootstrap.js';

const exec = promisify(require('child_process').exec);

interface InstallationState {
  mode: 'managed' | 'self-hosted';
  profile: 'core' | 'full';
  installDir: string;
  installedAt: string;
  dashboardUrl: string;
}

/**
 * Prompt user for a choice between options.
 */
async function promptChoice(question: string, options: string[]): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log(`\n${question}`);
    options.forEach((opt, idx) => {
      console.log(`  ${idx + 1}. ${opt}`);
    });

    rl.question('Enter your choice (1-' + options.length + '): ', (answer) => {
      rl.close();
      const idx = parseInt(answer, 10) - 1;
      if (idx >= 0 && idx < options.length) {
        resolve(options[idx]);
      } else {
        console.error('Invalid choice. Please try again.');
        process.exit(1);
      }
    });
  });
}

/**
 * Display profile details and confirm selection.
 */
async function displayProfileDetails(profile: 'core' | 'full'): Promise<void> {
  const profiles: Record<string, string[]> = {
    core: ['API', 'Dashboard', 'Neo4j', 'Discovery', 'Cartography', 'Auth/Bootstrap Service'],
    full: [
      'API',
      'Dashboard',
      'Neo4j',
      'Discovery',
      'Cartography',
      'Auth/Bootstrap Service',
      'Chatbot',
      'Agents',
      'Chroma Vector Database',
    ],
  };

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║  ${profile.toUpperCase()} Profile Services                                  ║`);
  console.log(`╠════════════════════════════════════════════════════════════╣`);

  const services = profiles[profile] || [];
  for (const service of services) {
    console.log(`║  • ${service.padEnd(54)}║`);
  }

  console.log(`╚════════════════════════════════════════════════════════════╝`);
}

/**
 * Poll service health endpoints until all pass or timeout.
 */
async function pollHealthChecks(manifest: InstallManifest, timeoutMs: number = 300000): Promise<boolean> {
  const startTime = Date.now();
  const healthEndpoints: Record<string, string> = {
    api: 'http://localhost:8000/health',
    dashboard: 'http://localhost:3000/health',
    neo4j: 'http://localhost:7474/health',
    discovery: 'http://localhost:8080/health',
  };

  console.log('\nPolling service health endpoints...');

  while (Date.now() - startTime < timeoutMs) {
    let allHealthy = true;

    for (const service of manifest.services) {
      const endpoint = healthEndpoints[service];
      if (!endpoint) continue;

      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          allHealthy = false;
          console.log(`  ⏳ ${service}: waiting...`);
        } else {
          console.log(`  ✓ ${service}: healthy`);
        }
      } catch (err) {
        allHealthy = false;
        console.log(`  ⏳ ${service}: waiting...`);
      }
    }

    if (allHealthy) {
      console.log('\n✓ All services are healthy!');
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  console.error('\n✗ Health check timeout after 5 minutes');
  return false;
}

/**
 * Rollback: stop and remove CIG containers and generated config files.
 */
async function rollback(installDir: string): Promise<void> {
  console.log('\nRolling back installation...');

  try {
    // Stop and remove containers
    execSync('docker compose down', { cwd: installDir, stdio: 'pipe' });
    execSync('docker compose rm -f', { cwd: installDir, stdio: 'pipe' });
    console.log('✓ Stopped and removed CIG containers');

    // Delete generated config files
    const filesToDelete = [
      path.join(installDir, 'docker-compose.yml'),
      path.join(installDir, '.env'),
    ];

    for (const file of filesToDelete) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }

    console.log('✓ Deleted generated config files');
  } catch (err) {
    console.error('Rollback error:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Write installation state to ~/.cig/state.json with permissions 0600.
 */
function writeInstallationState(state: InstallationState): void {
  const configDir = path.join(os.homedir(), '.cig');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { mode: 0o700, recursive: true });
  }

  const stateFile = path.join(configDir, 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
}

/**
 * Main install orchestration function.
 */
export async function install(
  apiUrl: string = 'http://localhost:8000',
  mode?: 'managed' | 'self-hosted',
  profile?: 'core' | 'full'
): Promise<void> {
  const credentialManager = new CredentialManager();
  const installDir = path.join(os.homedir(), '.cig', 'install');

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              CIG Installation Wizard                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Step 1: Run prerequisite checks
  console.log('\nStep 1: Running prerequisite checks...');
  const prereqResults = await runAllChecks();
  const allPassed = prereqResults.every((r) => r.passed);

  if (!allPassed) {
    console.error('\n✗ Prerequisite checks failed:');
    for (const result of prereqResults) {
      if (!result.passed) {
        console.error(`  • ${result.message}`);
        if (result.remediation) {
          console.error(`    Remediation: ${result.remediation}`);
        }
      }
    }
    process.exit(1);
  }

  console.log('✓ All prerequisite checks passed');

  // Step 2: Prompt for mode if not provided
  if (!mode) {
    mode = (await promptChoice('Select installation mode:', ['managed', 'self-hosted'])) as
      | 'managed'
      | 'self-hosted';
  }

  console.log(`\nSelected mode: ${mode}`);

  // Step 3: Branch to enrollment or bootstrap flow
  let manifest: InstallManifest;

  if (mode === 'managed') {
    console.log('\nStep 2: Managed enrollment flow...');
    manifest = await enrollmentFlow(apiUrl);
  } else {
    console.log('\nStep 2: Self-hosted bootstrap flow...');
    manifest = await bootstrapFlow();
  }

  // Step 4: Prompt for profile if not provided
  if (!profile) {
    profile = (await promptChoice('Select installation profile:', ['core', 'full'])) as 'core' | 'full';
  }

  console.log(`\nSelected profile: ${profile}`);
  await displayProfileDetails(profile);

  // Update manifest with selected profile
  manifest.profile = profile;

  // Step 5: Generate compose files
  console.log('\nStep 3: Generating compose files...');
  if (!fs.existsSync(installDir)) {
    fs.mkdirSync(installDir, { mode: 0o700, recursive: true });
  }

  await generateCompose(manifest, installDir);
  console.log(`✓ Generated docker-compose.yml and .env in ${installDir}`);

  // Step 6: Start services
  console.log('\nStep 4: Starting services...');
  try {
    execSync('docker compose up -d', { cwd: installDir, stdio: 'inherit' });
    console.log('✓ Services started');
  } catch (err) {
    console.error('✗ Failed to start services:', err instanceof Error ? err.message : String(err));
    await rollback(installDir);
    process.exit(1);
  }

  // Step 7: Poll health checks
  console.log('\nStep 5: Waiting for services to be healthy...');
  const healthChecksPassed = await pollHealthChecks(manifest);

  if (!healthChecksPassed) {
    console.error('✗ Health checks failed');
    await rollback(installDir);
    process.exit(1);
  }

  // Step 8: Write installation state
  const state: InstallationState = {
    mode,
    profile,
    installDir,
    installedAt: new Date().toISOString(),
    dashboardUrl: 'http://localhost:3000',
  };

  writeInstallationState(state);
  console.log('✓ Installation state saved to ~/.cig/state.json');

  // Step 9: Display success message
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              ✓ Installation Complete!                      ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Dashboard URL: ${state.dashboardUrl.padEnd(42)}║`);
  console.log('║                                                            ║');
  console.log('║  Next steps:                                               ║');
  console.log('║  1. Open the Dashboard URL in your browser                 ║');

  if (mode === 'self-hosted') {
    const bootstrapToken = credentialManager.loadBootstrapToken();
    if (bootstrapToken) {
      console.log(`║  2. Enter bootstrap token: ${bootstrapToken.token.padEnd(32)}║`);
    }
  }

  console.log('║  3. Complete the setup wizard                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}
