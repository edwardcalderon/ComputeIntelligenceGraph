import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import { StateManager } from '../managers/state-manager.js';

export async function uninstall(purgeData = false): Promise<void> {
  const stateManager = new StateManager();
  const state = await stateManager.load();

  if (!state) {
    console.log('No installation state found.');
    return;
  }

  if (state.mode === 'self-hosted') {
    try {
      execSync('docker compose down', { cwd: state.installDir, stdio: 'inherit' });
    } catch {
      // Best effort.
    }
  }

  if (purgeData && fs.existsSync(state.installDir)) {
    fs.rmSync(state.installDir, { recursive: true, force: true });
  }

  await stateManager.delete();
  console.log('✓ Uninstalled CIG runtime metadata.');
}
