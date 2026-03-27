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
import * as fs from 'fs';
import * as path from 'path';
import { CredentialManager, BootstrapToken } from '../credentials.js';
import { resolveCliPaths } from '../storage/paths.js';

/**
 * Generate a cryptographically random 32-character bootstrap token.
 */
function generateBootstrapToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Bootstrap reset command.
 * Generates a new token, overwrites the install dir token file (0600), and displays it.
 * Requirements: 13.2, 13.8
 */
export async function bootstrapReset(): Promise<void> {
  const credentialManager = new CredentialManager();
  const paths = resolveCliPaths();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              Bootstrap Token Reset                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Generate new bootstrap token
  console.log('\nGenerating new bootstrap token...');
  const token = generateBootstrapToken();
  console.log('✓ New bootstrap token generated');

  // Save in the encrypted CLI secrets store.
  const bootstrapTokenData: BootstrapToken = {
    token,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
  };

  try {
    credentialManager.saveBootstrapToken(bootstrapTokenData);
    console.log(`✓ New bootstrap token saved to ${paths.secretsFile}`);
  } catch (err) {
    throw new Error(`Failed to save bootstrap token: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Overwrite the install dir token file with 0600 permissions (Requirements 13.2, 13.8)
  const tokenFile = path.join(paths.installDir, '.bootstrap-token');
  try {
    fs.mkdirSync(paths.installDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(tokenFile, token, { mode: 0o600, encoding: 'utf8' });
    console.log(`✓ Bootstrap token file overwritten at ${tokenFile} (0600)`);
  } catch (err) {
    console.warn(`Warning: Could not overwrite bootstrap token file: ${err instanceof Error ? err.message : String(err)}`);
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
