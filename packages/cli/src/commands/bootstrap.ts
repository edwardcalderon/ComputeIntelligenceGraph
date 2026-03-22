/**
 * Self-Hosted Bootstrap Sub-Flow
 *
 * Implements the bootstrap flow for self-hosted mode:
 * 1. Generate cryptographically random 32-character Bootstrap_Token
 * 2. Save to the encrypted CLI secrets store
 * 3. Display Dashboard URL and token prominently
 * 4. Return minimal InstallManifest for compose generation
 *
 * Requirement 5: Self-Hosted Bootstrap Flow
 */

import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { CredentialManager, BootstrapToken } from '../credentials.js';
import { InstallManifest } from '../compose-generator.js';
import { resolveCliPaths } from '../storage/paths.js';

/**
 * Generate a cryptographically random 32-character bootstrap token.
 */
function generateBootstrapToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Bootstrap flow for self-hosted mode.
 * Returns minimal InstallManifest for compose generation.
 */
export async function bootstrapFlow(): Promise<InstallManifest> {
  const credentialManager = new CredentialManager();

  // Step 1: Generate bootstrap token
  console.log('Generating bootstrap token...');
  const token = generateBootstrapToken();
  console.log('✓ Bootstrap token generated');

  // Step 2: Save in the encrypted CLI secrets store.
  const bootstrapTokenData: BootstrapToken = {
    token,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
  };

  try {
    credentialManager.saveBootstrapToken(bootstrapTokenData);
    console.log(`✓ Bootstrap token saved to ${resolveCliPaths().secretsFile}`);
  } catch (err) {
    console.error('✗ Failed to save bootstrap token:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Step 3: Display Dashboard URL and token prominently
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              Self-Hosted Bootstrap Setup                   ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║                                                            ║');
  console.log('║  Dashboard URL:                                            ║');
  console.log('║  http://localhost:3000                                     ║');
  console.log('║                                                            ║');
  console.log('║  Bootstrap Token:                                          ║');
  console.log(`║  ${token.padEnd(56)}║`);
  console.log('║                                                            ║');
  console.log('║  Keep this token safe! You will need it to complete       ║');
  console.log('║  the initial setup.                                        ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Step 4: Return minimal InstallManifest for compose generation
  const manifest: InstallManifest = {
    profile: 'core',
    services: ['api', 'dashboard', 'neo4j', 'discovery', 'cartography'],
    env_overrides: {
      CIG_AUTH_MODE: 'self-hosted',
      CIG_BOOTSTRAP_TOKEN: token,
    },
  };

  return manifest;
}
