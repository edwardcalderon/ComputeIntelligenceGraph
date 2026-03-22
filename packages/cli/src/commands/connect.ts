import { randomUUID } from 'node:crypto';
import { CredentialManager } from '../credentials.js';
import { ConnectionProfileStore } from '../stores/connection-profile-store.js';
import { ConnectionProfile } from '../types/runtime.js';

export function connectAws(roleArn: string): void {
  const credentialManager = new CredentialManager();
  credentialManager.save('aws', roleArn);
  console.log(`✓ Saved AWS discovery role: ${roleArn}`);
}

export function connectGcp(serviceAccountPath: string): void {
  const credentialManager = new CredentialManager();
  credentialManager.save('gcp', serviceAccountPath);
  console.log(`✓ Saved GCP service account reference: ${serviceAccountPath}`);
}

export function connectApi(
  apiUrl: string,
  authMode: 'managed' | 'self-hosted' | 'none' | string = 'none'
): void {
  const profileStore = new ConnectionProfileStore();
  const now = new Date().toISOString();
  const resolvedAuthMode =
    authMode === 'managed' || authMode === 'self-hosted' || authMode === 'none'
      ? authMode
      : 'none';
  const profile: ConnectionProfile = {
    id: randomUUID(),
    name: apiUrl,
    type:
      resolvedAuthMode === 'managed'
        ? 'managed-cloud'
        : resolvedAuthMode === 'self-hosted'
          ? 'self-hosted'
          : 'direct-api',
    apiUrl,
    authMode: resolvedAuthMode,
    dashboardUrl: apiUrl.replace(/:8000$/, ':3000'),
    createdAt: now,
    updatedAt: now,
    isDefault: profileStore.list().length === 0,
  };

  profileStore.save(profile);
  if (profile.isDefault) {
    profileStore.setDefault(profile.id);
  }
  console.log(`✓ Saved connection profile for ${apiUrl}`);
}
