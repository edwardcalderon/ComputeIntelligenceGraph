import { StateManager } from '../managers/state-manager.js';

export async function upgrade(): Promise<void> {
  const stateManager = new StateManager();
  const state = await stateManager.load();

  if (!state) {
    throw new Error('No existing installation found. Run `cig install` first.');
  }

  await stateManager.update({ status: 'stopped' });
  console.log('Prepared the installation for a runtime upgrade. Bundle rollout is not yet automated.');
}
