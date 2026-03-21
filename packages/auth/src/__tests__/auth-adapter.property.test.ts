/**
 * Property-based tests for the auth adapter (LocalJWTAdapter).
 *
 * Properties tested:
 *   Property 1: Auth adapter token verification round trip
 *   Property 2: Auth adapter rejects expired tokens
 *   Property 3: Auth adapter rejects tampered tokens
 *
 * Feature: cig-auth-provisioning
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SignJWT } from 'jose';
import { LocalJWTAdapter } from '../adapters/local-jwt-adapter';

// ─── Global configuration ─────────────────────────────────────────────────────

fc.configureGlobal({ numRuns: 100 });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Signs a JWT with HMAC-SHA256 using the given secret and claims.
 * expiresIn can be a string like '1h' or a Unix timestamp (number).
 */
async function signToken(
  secret: string,
  claims: Record<string, unknown>,
  expiresIn: string | number = '1h'
): Promise<string> {
  const secretKey = Buffer.from(secret, 'utf-8');
  return new SignJWT(claims as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

/**
 * Signs a JWT with a *different* HMAC-SHA256 secret (wrong key).
 */
async function signTokenWithWrongKey(
  claims: Record<string, unknown>
): Promise<string> {
  const wrongSecret = Buffer.from('wrong-secret-key-that-is-not-the-real-one', 'utf-8');
  return new SignJWT(claims as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(wrongSecret);
}

/**
 * Tampers with a JWT by flipping a character in the signature segment.
 */
function tamperSignature(token: string): string {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Not a valid JWT');
  const sig = parts[2];
  // Flip the first character of the signature
  const firstChar = sig[0];
  const replacement = firstChar === 'A' ? 'B' : 'A';
  parts[2] = replacement + sig.slice(1);
  return parts.join('.');
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * A valid HMAC secret.
 * jose enforces a minimum key length of 256 bits (32 bytes) for HS256,
 * so we generate secrets of at least 32 ASCII characters.
 */
const secretArb = fc.string({ minLength: 32, maxLength: 64 }).filter(s => Buffer.byteLength(s, 'utf-8') >= 32);

/** A valid sub claim (user ID). */
const subArb = fc.uuid();

/** A valid email address. */
const emailArb = fc.emailAddress();

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 1: Auth adapter token verification round trip', () => {
  // Feature: cig-auth-provisioning, Property 1: For any valid token issued by the configured issuer,
  // adapter.verifyToken(token) should return claims that include the original sub and email values.
  // For any token issued by a different issuer or signed with a wrong key, verifyToken should throw.
  // Validates: Requirements 2.1, 2.2

  it('verifyToken returns original sub and email for valid tokens', async () => {
    await fc.assert(
      fc.asyncProperty(secretArb, subArb, emailArb, async (secret, sub, email) => {
        const adapter = new LocalJWTAdapter({ secret });
        const token = await signToken(secret, { sub, email });

        const claims = await adapter.verifyToken(token);

        expect(claims.sub).toBe(sub);
        expect(claims.email).toBe(email);
        expect(claims.mode).toBe('self-hosted');
      }),
      { numRuns: 100 }
    );
  });

  it('verifyToken throws for tokens signed with a wrong key', async () => {
    await fc.assert(
      fc.asyncProperty(secretArb, subArb, emailArb, async (secret, sub, email) => {
        const adapter = new LocalJWTAdapter({ secret });
        const token = await signTokenWithWrongKey({ sub, email });

        await expect(adapter.verifyToken(token)).rejects.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it('verifyToken throws with token_invalid code for wrong-key tokens', async () => {
    await fc.assert(
      fc.asyncProperty(secretArb, subArb, emailArb, async (secret, sub, email) => {
        const adapter = new LocalJWTAdapter({ secret });
        const token = await signTokenWithWrongKey({ sub, email });

        try {
          await adapter.verifyToken(token);
          // Should not reach here
          expect(true).toBe(false);
        } catch (err) {
          expect((err as NodeJS.ErrnoException).code).toBe('token_invalid');
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 2: Auth adapter rejects expired tokens', () => {
  // Feature: cig-auth-provisioning, Property 2: For any token whose exp claim is in the past,
  // adapter.verifyToken(token) should throw with an error indicating token_expired.
  // Validates: Requirements 2.10

  it('verifyToken throws token_expired for tokens with past exp', async () => {
    await fc.assert(
      fc.asyncProperty(
        secretArb,
        subArb,
        emailArb,
        // Generate a past timestamp: between 1 second and 1 year ago
        fc.integer({ min: 1, max: 365 * 24 * 3600 }),
        async (secret, sub, email, secondsAgo) => {
          const adapter = new LocalJWTAdapter({ secret });
          const pastExp = Math.floor(Date.now() / 1000) - secondsAgo;
          const token = await signToken(secret, { sub, email }, pastExp);

          try {
            await adapter.verifyToken(token);
            // Should not reach here
            expect(true).toBe(false);
          } catch (err) {
            expect((err as NodeJS.ErrnoException).code).toBe('token_expired');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 3: Auth adapter rejects tampered tokens', () => {
  // Feature: cig-auth-provisioning, Property 3: For any token whose signature has been altered,
  // adapter.verifyToken(token) should throw with an error indicating token_invalid.
  // Validates: Requirements 2.11

  it('verifyToken throws token_invalid for tampered signatures', async () => {
    await fc.assert(
      fc.asyncProperty(secretArb, subArb, emailArb, async (secret, sub, email) => {
        const adapter = new LocalJWTAdapter({ secret });
        const validToken = await signToken(secret, { sub, email });
        const tamperedToken = tamperSignature(validToken);

        try {
          await adapter.verifyToken(tamperedToken);
          // Should not reach here
          expect(true).toBe(false);
        } catch (err) {
          expect((err as NodeJS.ErrnoException).code).toBe('token_invalid');
        }
      }),
      { numRuns: 100 }
    );
  });
});
