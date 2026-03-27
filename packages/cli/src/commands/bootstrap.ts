/**
 * Self-Hosted Bootstrap Sub-Flow
 *
 * Implements the bootstrap flow for self-hosted mode:
 * 1. Generate cryptographically random 32-character Bootstrap_Token
 * 2. Save to the encrypted CLI secrets store
 * 3. Write to install dir with 0600 permissions (Requirements 13.2, 13.3)
 * 4. Display Dashboard URL and token prominently
 * 5. Return minimal InstallManifest for compose generation
 *
 * Requirement 5: Self-Hosted Bootstrap Flow
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { CredentialManager, BootstrapToken } from '../credentials.js';
import { InstallManifest } from '../compose-generator.js';
import { resolveCliPaths } from '../storage/paths.js';

export interface BootstrapFlowOptions {
  profile?: 'discovery' | 'full';
}

/**
 * Generate a cryptographically random 32-character bootstrap token.
 */
function generateBootstrapToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Write the bootstrap token to the install dir with 0600 permissions.
 * Requirements: 13.2, 13.3
 */
function writeBootstrapTokenToInstallDir(token: string, installDir: string): void {
  const tokenFile = path.join(installDir, '.bootstrap-token');
  fs.mkdirSync(installDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(tokenFile, token, { mode: 0o600, encoding: 'utf8' });
}

/**
 * Bootstrap flow for self-hosted mode.
 * Returns minimal InstallManifest for compose generation.
 */
export async function bootstrapFlow(options: BootstrapFlowOptions = {}): Promise<InstallManifest> {
  const credentialManager = new CredentialManager();
  const paths = resolveCliPaths();
  const profile = options.profile ?? 'discovery';

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
    console.log(`✓ Bootstrap token saved to ${paths.secretsFile}`);
  } catch (err) {
    throw new Error(`Failed to save bootstrap token: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 3: Write to install dir with 0600 permissions (Requirements 13.2, 13.3)
  try {
    writeBootstrapTokenToInstallDir(token, paths.installDir);
    console.log(`✓ Bootstrap token written to ${path.join(paths.installDir, '.bootstrap-token')} (0600)`);
  } catch (err) {
    // Non-fatal — the secrets store copy is the primary path
    console.warn(`Warning: Could not write bootstrap token to install dir: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 4: Display Dashboard URL and token prominently
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

  // Step 5: Return minimal InstallManifest for compose generation
  const manifest: InstallManifest = {
    profile,
    services:
      profile === 'full'
        ? ['api', 'dashboard', 'neo4j', 'discovery', 'cartography', 'chatbot']
        : ['api', 'dashboard', 'neo4j', 'discovery', 'cartography'],
    env_overrides: {
      CIG_AUTH_MODE: 'self-hosted',
      CIG_BOOTSTRAP_TOKEN: token,
    },
  };

  return manifest;
}
