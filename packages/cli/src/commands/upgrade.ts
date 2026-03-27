/**
 * `cig upgrade` — Upgrade CIG Node Runtime
 *
 * Finds the install directory (from state, env CIG_INSTALL_DIR, or default
 * /opt/cig-node), then runs:
 *   docker compose pull
 *   docker compose up -d
 *
 * Requirements: 4.9
 */

import { spawnSync } from 'node:child_process';
import { StateManager } from '../managers/state-manager.js';
import { resolveCliPaths } from '../storage/paths.js';

function resolveInstallDir(stateInstallDir?: string): string {
  return stateInstallDir ?? process.env['CIG_INSTALL_DIR'] ?? resolveCliPaths().installDir;
}

function runDockerCompose(args: string[], cwd: string): boolean {
  const result = spawnSync('docker', ['compose', ...args], {
    cwd,
    stdio: 'inherit',
    encoding: 'utf-8',
  });

  if (result.error) {
    console.error(`  docker compose ${args.join(' ')} failed: ${result.error.message}`);
    return false;
  }

  if (result.status !== 0) {
    console.error(`  docker compose ${args.join(' ')} exited with code ${result.status}`);
    return false;
  }

  return true;
}

/**
 * `cig upgrade` — pull new images and restart services.
 */
export async function upgrade(): Promise<void> {
  const stateManager = new StateManager();
  const state = await stateManager.load();

  const installDir = resolveInstallDir(state?.installDir);

  console.log(`  Upgrading CIG Node runtime in ${installDir} ...`);
  console.log('');

  // Step 1: pull new images
  console.log('  Pulling latest images ...');
  const pullOk = runDockerCompose(['pull'], installDir);
  if (!pullOk) {
    console.error('✗ Image pull failed. Upgrade aborted.');
    process.exitCode = 1;
    return;
  }

  // Step 2: restart services with new images
  console.log('  Restarting services ...');
  const upOk = runDockerCompose(['up', '-d'], installDir);
  if (!upOk) {
    console.error('✗ Service restart failed. Check `docker compose logs` for details.');
    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log('✓ CIG Node runtime upgraded successfully.');
}
