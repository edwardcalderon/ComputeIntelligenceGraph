import { StateManager } from '../managers/state-manager.js';
import { ConnectionProfileStore } from '../stores/connection-profile-store.js';

export async function openDashboard(): Promise<void> {
  const stateManager = new StateManager();
  const profileStore = new ConnectionProfileStore();
  const state = await stateManager.load();
  const profile = profileStore.getDefault();

  const url =
    (state?.mode === 'self-hosted' ? 'http://127.0.0.1:3000' : undefined) ??
    profile?.dashboardUrl ??
    profile?.apiUrl ??
    'http://127.0.0.1:3000';

  console.log(url);
}
