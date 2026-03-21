/**
 * Logout Command
 *
 * Clears all stored tokens and identity via CredentialManager,
 * and POSTs to /auth/logout (best-effort, doesn't fail if it fails).
 *
 * Requirement 3: CLI Device Authorization Login Flow
 */

import { CredentialManager } from '../credentials.js';

export async function logout(apiUrl: string): Promise<void> {
  const credentialManager = new CredentialManager();

  // Load tokens to get access token for logout request
  const tokens = credentialManager.loadTokens();

  // Clear all stored credentials
  try {
    credentialManager.clearAll();
    console.log('✓ Credentials cleared.');
  } catch (err) {
    console.error('Warning: Failed to clear credentials:', err instanceof Error ? err.message : String(err));
  }

  // POST to /auth/logout (best-effort)
  if (tokens?.accessToken) {
    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        console.warn(`Logout request returned ${response.status}; credentials already cleared locally.`);
      }
    } catch (err) {
      console.warn('Logout request failed (credentials already cleared locally):', err instanceof Error ? err.message : String(err));
    }
  }

  console.log('✓ Logout complete.');
}
