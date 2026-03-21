/**
 * Bootstrap Reset Command
 *
 * Generates a new Bootstrap_Token, saves it, and displays it.
 * Used when the previous token has expired (30 minutes after generation).
 *
 * Requirement 5.12: THE CLI SHALL provide a `cig bootstrap-reset` command
 * to generate and display a new token
 */

import * as crypto from 'crypto';
import { CredentialManager, BootstrapToken } from '../credentials.js';

/**
 * Generate a cryptographically random 32-character bootstrap token.
 */
function generateBootstrapToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Bootstrap reset command.
 */
export async function bootstrapReset(): Promise<void> {
  const credentialManager = new CredentialManager();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              Bootstrap Token Reset                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Generate new bootstrap token
  console.log('\nGenerating new bootstrap token...');
  const token = generateBootstrapToken();
  console.log('✓ New bootstrap token generated');

  // Save to ~/.cig/bootstrap.json with permissions 0600
  const bootstrapTokenData: BootstrapToken = {
    token,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
  };

  try {
    credentialManager.saveBootstrapToken(bootstrapTokenData);
    console.log('✓ New bootstrap token saved to ~/.cig/bootstrap.json');
  } catch (err) {
    console.error('✗ Failed to save bootstrap token:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Display new token prominently
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              New Bootstrap Token                           ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║                                                            ║');
  console.log(`║  ${token.padEnd(56)}║`);
  console.log('║                                                            ║');
  console.log('║  This token is valid for 30 minutes.                       ║');
  console.log('║  Use it to complete the bootstrap setup at:                ║');
  console.log('║  http://localhost:3000/bootstrap                           ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}
