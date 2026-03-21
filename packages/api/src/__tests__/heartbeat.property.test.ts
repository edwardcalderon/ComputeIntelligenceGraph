/**
 * Property-based tests for the heartbeat Ed25519 signature round trip.
 *
 * Properties tested:
 *   Property 15: Ed25519 heartbeat signature round trip
 *
 * Feature: cig-auth-provisioning
 *
 * **Validates: Requirements 8.3, 8.4, 14.2**
 */

// Feature: cig-auth-provisioning, Property 15: For any request body bytes and Ed25519 key pair,
// signing the body with the private key and verifying with the public key should succeed;
// verifying with a different public key should fail.
// Validates: Requirements 8.3, 8.4, 14.2

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import crypto from 'crypto';
import { verifyEd25519Signature } from '../middleware/node-auth';

// ─── Global configuration ─────────────────────────────────────────────────────

// Crypto properties benefit from more iterations
fc.configureGlobal({ numRuns: 1000 });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateKeyPair(): { privateKey: string; publicKey: string } {
  return crypto.generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
}

function signBody(body: Buffer, privateKey: string): string {
  const sig = crypto.sign(null, body, privateKey);
  return sig.toString('base64');
}

// ─── Property 15: Ed25519 heartbeat signature round trip ─────────────────────

describe('Property 15: Ed25519 heartbeat signature round trip', () => {
  it('signing with private key and verifying with matching public key always succeeds', () => {
    // Pre-generate a key pair outside the property to keep runs fast
    const { privateKey, publicKey } = generateKeyPair();

    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 4096 }),
        (bodyBytes) => {
          const body = Buffer.from(bodyBytes);
          const signature = signBody(body, privateKey);
          const result = verifyEd25519Signature(body, signature, publicKey);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('verifying with a different public key always fails', () => {
    const { privateKey } = generateKeyPair();
    const { publicKey: differentPublicKey } = generateKeyPair();

    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 4096 }),
        (bodyBytes) => {
          const body = Buffer.from(bodyBytes);
          const signature = signBody(body, privateKey);
          const result = verifyEd25519Signature(body, signature, differentPublicKey);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('a tampered body does not verify against the original signature', () => {
    const { privateKey, publicKey } = generateKeyPair();

    fc.assert(
      fc.property(
        // Need at least 1 byte so we can flip a bit
        fc.uint8Array({ minLength: 1, maxLength: 4096 }),
        (bodyBytes) => {
          const original = Buffer.from(bodyBytes);
          const signature = signBody(original, privateKey);

          // Flip the first byte to tamper the body
          const tampered = Buffer.from(original);
          tampered[0] = tampered[0]! ^ 0xff;

          const result = verifyEd25519Signature(tampered, signature, publicKey);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('an invalid base64 signature returns false without throwing', () => {
    const { publicKey } = generateKeyPair();

    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 256 }),
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => {
          // Ensure it's not accidentally valid base64 of the right length
          try {
            const buf = Buffer.from(s, 'base64');
            return buf.length !== 64; // Ed25519 signatures are 64 bytes
          } catch {
            return true;
          }
        }),
        (bodyBytes, badSignature) => {
          const body = Buffer.from(bodyBytes);
          const result = verifyEd25519Signature(body, badSignature, publicKey);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 500 }
    );
  });
});
