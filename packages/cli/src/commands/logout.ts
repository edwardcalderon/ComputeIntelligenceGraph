/**
 * Logout Command
 *
 * Clears all stored tokens and identity via CredentialManager,
 * and POSTs to /auth/logout (best-effort, doesn't fail if it fails).
 *
 * Requirement 3: CLI Device Authorization Login Flow
 */

import { CredentialManager } from '../credentials.js';
import { ApiClient } from '../services/api-client.js';

export async function logout(apiUrl: string): Promise<void> {
  const credentialManager = new CredentialManager();
  const apiClient = new ApiClient({ baseUrl: apiUrl, accessToken: credentialManager.loadTokens()?.accessToken });

  // Load tokens and session_id before clearing
  const tokens = credentialManager.loadTokens();
  const sessionId = credentialManager.loadSessionId();

  // Revoke session server-side before clearing local state
  if (tokens?.accessToken && sessionId) {
    try {
      await apiClient.delete(`/api/v1/sessions/${sessionId}`);
      console.log('✓ Session revoked on server.');
    } catch (err) {
      console.warn('Session revocation failed (will clear locally):', err instanceof Error ? err.message : String(err));
    }
  }

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
      await apiClient.post('/api/v1/auth/logout');
    } catch (err) {
      console.warn('Logout request failed (credentials already cleared locally):', err instanceof Error ? err.message : String(err));
    }
  }

  console.log('✓ Logout complete.');
}
