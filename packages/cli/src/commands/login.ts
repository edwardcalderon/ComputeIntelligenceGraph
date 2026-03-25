/**
 * Device Authorization Login Command
 *
 * Implements RFC 8628 device authorization grant flow:
 * 1. POST to /auth/device/authorize to get device_code, user_code, verification_uri
 * 2. Display user_code and verification_uri prominently
 * 3. Poll /auth/device/poll at 5s intervals with exponential backoff on slow_down
 * 4. On approval, store tokens via CredentialManager
 * 5. On denial or expiry, display error and exit(1)
 *
 * Requirement 3: CLI Device Authorization Login Flow
 */

import { CredentialManager, AuthTokens } from '../credentials.js';
import { ApiClient } from '../services/api-client.js';
import { ConnectionProfileStore } from '../stores/connection-profile-store.js';
import { ConnectionProfile } from '../types/runtime.js';
import { syncPendingInitialGraphArtifacts } from '../services/initial-graph.js';
import { resolveCliPaths } from '../storage/paths.js';
import { intro, outro, spinner } from '@clack/prompts';

interface DeviceAuthorizeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
}

interface DevicePollResponse {
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'slow_down';
  access_token?: string;
  refresh_token?: string;
  session_id?: string;
  token_type?: string;
}

export async function login(apiUrl: string): Promise<void> {
  const credentialManager = new CredentialManager();
  const apiClient = new ApiClient({ baseUrl: apiUrl });
  const profileStore = new ConnectionProfileStore();

  intro('CIG Device Login');

  // Step 1: POST to /auth/device/authorize
  console.log('Initiating device authorization...');
  let authorizeResponse: DeviceAuthorizeResponse;

  try {
    authorizeResponse = await apiClient.post<DeviceAuthorizeResponse>('/api/v1/auth/device/authorize');
  } catch (err) {
    throw new Error(`Failed to initiate device authorization: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 2: Display user_code and verification_uri prominently
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                  Device Authorization                       ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  User Code:        ${authorizeResponse.user_code.padEnd(42)}║`);
  console.log(`║  Verification URL: ${authorizeResponse.verification_uri.padEnd(42)}║`);
  console.log('║                                                            ║');
  console.log('║  1. Visit the URL above in your browser                    ║');
  console.log('║  2. Enter the user code when prompted                      ║');
  console.log('║  3. Approve the device authorization                       ║');
  console.log('║                                                            ║');
  console.log('║  Waiting for approval...                                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Step 3: Poll /auth/device/poll with exponential backoff
  const deviceCode = authorizeResponse.device_code;
  const expiresAt = Date.now() + authorizeResponse.expires_in * 1000;
  let pollIntervalMs = 5000; // Start at 5 seconds
  const maxPollIntervalMs = 30000; // Max 30 seconds
  const waitSpinner = spinner();
  waitSpinner.start('Waiting for device approval...');

  while (Date.now() < expiresAt) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    let pollResponse: DevicePollResponse;

    try {
      pollResponse = await apiClient.post<DevicePollResponse>('/api/v1/auth/device/poll', {
        device_code: deviceCode,
      });
    } catch (err) {
      throw new Error(`Poll error: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Handle slow_down: increase poll interval with exponential backoff
    if (pollResponse.status === 'slow_down') {
      pollIntervalMs = Math.min(pollIntervalMs + 5000, maxPollIntervalMs);
      continue;
    }

    // Handle approved: store tokens and exit successfully
    if (pollResponse.status === 'approved') {
      if (!pollResponse.access_token || !pollResponse.refresh_token) {
        throw new Error('Approval response missing tokens');
      }

      const tokens: AuthTokens = {
        accessToken: pollResponse.access_token,
        refreshToken: pollResponse.refresh_token,
        expiresAt: Date.now() + 3600000, // Assume 1 hour expiry
        refreshExpiresAt: Date.now() + 86400000, // Assume 24 hour refresh expiry
      };

      try {
        credentialManager.saveTokens(tokens);
        // Persist session_id for server-side session management
        if (pollResponse.session_id) {
          credentialManager.saveSessionId(pollResponse.session_id);
        }
        const now = new Date().toISOString();
        const profile: ConnectionProfile = {
          id: 'managed-cloud',
          name: 'Managed Cloud',
          type: 'managed-cloud',
          apiUrl,
          authMode: 'managed',
          dashboardUrl: apiUrl.replace(':8000', ':3000'),
          createdAt: now,
          updatedAt: now,
          isDefault: true,
        };
        profileStore.save(profile);
        profileStore.setDefault(profile.id);
        const graphSync = await syncPendingInitialGraphArtifacts({
          apiUrl,
          installDir: resolveCliPaths().installDir,
          credentialManager,
        });
        if (graphSync.uploaded > 0) {
          console.log(`✓ Uploaded ${graphSync.uploaded} pending initial graph snapshot(s).`);
        }
        waitSpinner.stop('Device authorization approved.');
        outro('Login successful! Tokens stored securely.');
        return;
      } catch (err) {
        throw new Error(`Failed to store tokens: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Handle denied: display error and exit
    if (pollResponse.status === 'denied') {
      waitSpinner.stop('Device authorization denied.');
      throw new Error('Device authorization denied.');
    }

    // Handle expired: display error and exit
    if (pollResponse.status === 'expired') {
      waitSpinner.stop('Device authorization expired.');
      throw new Error('Device code expired. Please run `cig login` again.');
    }

    // Status is pending, continue polling
  }

  // Timeout: device code expired
  waitSpinner.stop('Device code expired.');
  throw new Error('Device code expired. Please run `cig login` again.');
}
