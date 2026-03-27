/**
 * CIG Node installation directory management.
 *
 * Handles identity file persistence, bootstrap token storage, and
 * install directory setup for the CIG Node runtime.
 *
 * Requirements: 6.2, 7.4, 13.2, 13.3
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Inline type — mirrors packages/sdk/src/types.ts NodeIdentity
export interface NodeIdentity {
  nodeId: string;
  privateKey: string; // Ed25519 private key, base64
  publicKey: string;  // Ed25519 public key, base64
  issuedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const INSTALL_DIR = '/opt/cig-node';
export const IDENTITY_FILE = path.join(INSTALL_DIR, '.node-identity');
export const BOOTSTRAP_TOKEN_FILE = path.join(INSTALL_DIR, '.bootstrap-token');

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;
const SALT_LEN = 16;
const TAG_LEN = 16;
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_DIGEST = 'sha256';

// ---------------------------------------------------------------------------
// Bootstrap token generation (Requirements 13.2, 13.3)
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random 32-character bootstrap token.
 * Uses crypto.randomBytes for secure random generation.
 */
export function generateBootstrapToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Write the bootstrap token to BOOTSTRAP_TOKEN_FILE with 0600 permissions.
 * The token is written as plain text — it is a one-time secret displayed
 * to the operator once and stored for the bootstrap completion endpoint.
 *
 * Requirements: 13.2, 13.3
 */
export async function writeBootstrapToken(token: string): Promise<void> {
  const dir = path.dirname(BOOTSTRAP_TOKEN_FILE);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(BOOTSTRAP_TOKEN_FILE, token, { mode: 0o600, encoding: 'utf8' });
}

/**
 * Read the bootstrap token from BOOTSTRAP_TOKEN_FILE.
 * Returns null if the file does not exist.
 */
export function readBootstrapToken(): string | null {
  if (!fs.existsSync(BOOTSTRAP_TOKEN_FILE)) {
    return null;
  }
  return fs.readFileSync(BOOTSTRAP_TOKEN_FILE, 'utf8').trim();
}

// ---------------------------------------------------------------------------
// Node identity persistence (Requirements 6.2, 7.4, 7.7)
// ---------------------------------------------------------------------------

/**
 * Derive an AES-256 key from a passphrase and salt using PBKDF2.
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LEN, PBKDF2_DIGEST);
}

/**
 * Write a NodeIdentity to the encrypted identity file at IDENTITY_FILE.
 * The file is encrypted with AES-256-GCM using a key derived from the
 * node UUID as the passphrase. Permissions are set to 0600.
 *
 * Requirements: 6.2, 7.4
 */
export async function writeIdentityFile(
  identity: NodeIdentity,
  passphrase: string
): Promise<void> {
  const dir = path.dirname(IDENTITY_FILE);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(passphrase, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(identity), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Layout: [salt(16)] [iv(12)] [tag(16)] [ciphertext]
  const payload = Buffer.concat([salt, iv, tag, encrypted]);
  fs.writeFileSync(IDENTITY_FILE, payload, { mode: 0o600 });
}

/**
 * Read and decrypt the NodeIdentity from IDENTITY_FILE.
 * Throws if the file does not exist, the passphrase is wrong, or the
 * ciphertext has been tampered with.
 *
 * Requirements: 6.2, 7.4, 7.7
 */
export async function readIdentityFile(passphrase: string): Promise<NodeIdentity> {
  if (!fs.existsSync(IDENTITY_FILE)) {
    throw new Error(`Identity file not found: ${IDENTITY_FILE}`);
  }

  const payload = fs.readFileSync(IDENTITY_FILE);

  if (payload.length < SALT_LEN + IV_LEN + TAG_LEN) {
    throw new Error('Identity file is too short — it may be corrupted');
  }

  const salt = payload.subarray(0, SALT_LEN);
  const iv = payload.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = payload.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const ciphertext = payload.subarray(SALT_LEN + IV_LEN + TAG_LEN);

  const key = deriveKey(passphrase, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('Failed to decrypt identity file — wrong passphrase or tampered data');
  }

  let identity: NodeIdentity;
  try {
    identity = JSON.parse(plaintext.toString('utf8')) as NodeIdentity;
  } catch {
    throw new Error('Identity file contains invalid JSON after decryption');
  }

  if (!identity.nodeId || !identity.privateKey || !identity.publicKey) {
    throw new Error('Identity file is missing required fields: nodeId, privateKey, publicKey');
  }

  return identity;
}
