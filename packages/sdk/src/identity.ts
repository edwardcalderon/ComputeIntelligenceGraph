import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import type { NodeIdentity } from './types';

/**
 * Generate a new Ed25519 key pair and return a full NodeIdentity.
 * Keys are DER-encoded and base64-encoded for storage/transport.
 */
export function generateNodeIdentity(): NodeIdentity {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  return {
    nodeId: randomUUID(),
    privateKey: (privateKey as unknown as Buffer).toString('base64'),
    publicKey: (publicKey as unknown as Buffer).toString('base64'),
    issuedAt: new Date().toISOString(),
  };
}

/**
 * Sign a string payload using an Ed25519 private key (base64-encoded DER/PKCS8).
 * Returns the signature as a base64 string.
 */
export function signRequest(payload: string, privateKey: string): string {
  const keyBuffer = Buffer.from(privateKey, 'base64');
  const keyObject = crypto.createPrivateKey({ key: keyBuffer, format: 'der', type: 'pkcs8' });
  const signature = crypto.sign(null, Buffer.from(payload), keyObject);
  return signature.toString('base64');
}

/**
 * Verify an Ed25519 signature against a payload using a base64-encoded DER/SPKI public key.
 * Returns true if the signature is valid, false otherwise.
 */
export function verifySignature(payload: string, signature: string, publicKey: string): boolean {
  try {
    const keyBuffer = Buffer.from(publicKey, 'base64');
    const keyObject = crypto.createPublicKey({ key: keyBuffer, format: 'der', type: 'spki' });
    return crypto.verify(null, Buffer.from(payload), keyObject, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}
