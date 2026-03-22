import { StateManager } from '../managers/state-manager.js';
import { ConnectionProfileStore } from '../stores/connection-profile-store.js';

export async function status(asJson = false): Promise<void> {
  const stateManager = new StateManager();
  const profileStore = new ConnectionProfileStore();
  const state = await stateManager.load();
  const profile = profileStore.getDefault();

  const payload = {
    installation: state,
    connectionProfile: profile,
  };

  if (asJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log('CIG status');
  console.log(`  Install state: ${state?.status ?? 'not_installed'}`);
  console.log(`  Install mode: ${state?.mode ?? 'n/a'}`);
  console.log(`  Install dir: ${state?.installDir ?? 'n/a'}`);
  console.log(`  Connection profile: ${profile?.name ?? 'none'}`);
  if (state?.services?.length) {
    console.log('  Services:');
    state.services.forEach((service) => {
      console.log(`    - ${service.name}: ${service.status}`);
    });
  }
}
