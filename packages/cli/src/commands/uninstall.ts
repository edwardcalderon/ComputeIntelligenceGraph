/**
 * `cig uninstall` — Remove CIG Node Runtime
 *
 * Finds the install directory (from state, env CIG_INSTALL_DIR, or default
 * /opt/cig-node), then runs:
 *   docker compose down
 *
 * With --purge-data:
 *   docker volume rm <named volumes>
 *   rm -rf <installDir>
 *
 * Requirements: 4.10
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { StateManager } from '../managers/state-manager.js';

const DEFAULT_INSTALL_DIR = '/opt/cig-node';

// Named volumes created by the CIG Node compose stack
const CIG_NAMED_VOLUMES = ['neo4j-data', 'cig-node-data'];

function resolveInstallDir(stateInstallDir?: string): string {
  return stateInstallDir ?? process.env['CIG_INSTALL_DIR'] ?? DEFAULT_INSTALL_DIR;
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

function removeVolumes(volumes: string[]): void {
  for (const vol of volumes) {
    const result = spawnSync('docker', ['volume', 'rm', vol], {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    if (result.status === 0) {
      console.log(`  ✓ Removed volume: ${vol}`);
    } else {
      // Volume may not exist — not a fatal error
      console.log(`  - Volume not found (skipped): ${vol}`);
    }
  }
}

/**
 * `cig uninstall` — stop and remove the CIG Node runtime.
 *
 * @param purgeData  When true, also remove named volumes and the install directory.
 */
export async function uninstall(purgeData = false): Promise<void> {
  const stateManager = new StateManager();
  const state = await stateManager.load();

  const installDir = resolveInstallDir(state?.installDir);

  console.log(`  Uninstalling CIG Node runtime from ${installDir} ...`);
  console.log('');

  // Step 1: docker compose down
  if (fs.existsSync(installDir)) {
    console.log('  Stopping and removing containers ...');
    const downOk = runDockerCompose(['down'], installDir);
    if (!downOk) {
      console.warn('  Warning: docker compose down reported an error (continuing).');
    }
  } else {
    console.log(`  Install directory not found (${installDir}) — skipping docker compose down.`);
  }

  // Step 2: purge volumes and install dir if requested
  if (purgeData) {
    console.log('');
    console.log('  Removing named volumes ...');
    removeVolumes(CIG_NAMED_VOLUMES);

    if (fs.existsSync(installDir)) {
      console.log(`  Removing install directory: ${installDir}`);
      try {
        fs.rmSync(installDir, { recursive: true, force: true });
        console.log(`  ✓ Removed ${installDir}`);
      } catch (err) {
        console.error(
          `  Failed to remove ${installDir}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  // Step 3: clear local state
  await stateManager.delete();

  console.log('');
  console.log('✓ CIG Node runtime uninstalled.');
  if (purgeData) {
    console.log('  All data volumes and install directory have been purged.');
  } else {
    console.log('  Data volumes were preserved. Use --purge-data to remove them.');
  }
}
