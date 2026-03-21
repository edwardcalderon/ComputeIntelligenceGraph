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
  token_type?: string;
}

export async function login(apiUrl: string): Promise<void> {
  const credentialManager = new CredentialManager();

  // Step 1: POST to /auth/device/authorize
  console.log('Initiating device authorization...');
  let authorizeResponse: DeviceAuthorizeResponse;

  try {
    const response = await fetch(`${apiUrl}/api/v1/auth/device/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Device authorize failed: ${response.status} ${response.statusText}`);
    }

    authorizeResponse = (await response.json()) as DeviceAuthorizeResponse;
  } catch (err) {
    console.error('Failed to initiate device authorization:', err instanceof Error ? err.message : String(err));
    process.exit(1);
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

  while (Date.now() < expiresAt) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    let pollResponse: DevicePollResponse;

    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/device/poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_code: deviceCode }),
      });

      if (!response.ok) {
        throw new Error(`Poll failed: ${response.status} ${response.statusText}`);
      }

      pollResponse = (await response.json()) as DevicePollResponse;
    } catch (err) {
      console.error('Poll error:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    // Handle slow_down: increase poll interval with exponential backoff
    if (pollResponse.status === 'slow_down') {
      pollIntervalMs = Math.min(pollIntervalMs + 5000, maxPollIntervalMs);
      continue;
    }

    // Handle approved: store tokens and exit successfully
    if (pollResponse.status === 'approved') {
      if (!pollResponse.access_token || !pollResponse.refresh_token) {
        console.error('Approval response missing tokens');
        process.exit(1);
      }

      const tokens: AuthTokens = {
        accessToken: pollResponse.access_token,
        refreshToken: pollResponse.refresh_token,
        expiresAt: Date.now() + 3600000, // Assume 1 hour expiry
        refreshExpiresAt: Date.now() + 86400000, // Assume 24 hour refresh expiry
      };

      try {
        credentialManager.saveTokens(tokens);
        console.log('✓ Login successful! Tokens stored securely.');
        process.exit(0);
      } catch (err) {
        console.error('Failed to store tokens:', err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    }

    // Handle denied: display error and exit
    if (pollResponse.status === 'denied') {
      console.error('✗ Device authorization denied.');
      process.exit(1);
    }

    // Handle expired: display error and exit
    if (pollResponse.status === 'expired') {
      console.error('✗ Device code expired. Please run `cig login` again.');
      process.exit(1);
    }

    // Status is pending, continue polling
  }

  // Timeout: device code expired
  console.error('✗ Device code expired. Please run `cig login` again.');
  process.exit(1);
}
