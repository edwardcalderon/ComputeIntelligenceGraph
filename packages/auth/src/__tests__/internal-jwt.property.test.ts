/**
 * Property-based tests for internal JWT round trip.
 *
 * Properties tested:
 *   Property 16: Internal JWT round trip
 *
 * Feature: cig-auth-provisioning
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createInternalToken, verifyInternalToken } from '../internal-jwt';

// ─── Global configuration ─────────────────────────────────────────────────────

fc.configureGlobal({ numRuns: 100 });

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * A valid HMAC secret.
 * jose enforces a minimum key length of 256 bits (32 bytes) for HS256,
 * so we generate secrets of at least 32 ASCII characters.
 */
const secretArb = fc
  .string({ minLength: 32, maxLength: 64 })
  .filter((s) => Buffer.byteLength(s, 'utf-8') >= 32);

/** A valid service name. */
const serviceNameArb = fc.string({ minLength: 1, maxLength: 64 }).filter((s) => s.trim().length > 0);

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 16: Internal JWT round trip', () => {
  // Feature: cig-auth-provisioning, Property 16: For any service name and HMAC secret,
  // verifyInternalToken(createInternalToken(serviceName, secret), secret) should return
  // a payload with iss === "cig-internal" and sub === serviceName.
  // A token verified with a different secret should throw.
  // Validates: Requirements 17.1, 17.2, 17.3, 17.4

  it('verifyInternalToken returns iss="cig-internal" and correct sub for valid round trip', async () => {
    await fc.assert(
      fc.asyncProperty(serviceNameArb, secretArb, async (serviceName, secret) => {
        const token = createInternalToken(serviceName, secret);
        const payload = await verifyInternalToken(token, secret);

        expect(payload.iss).toBe('cig-internal');
        expect(payload.sub).toBe(serviceName);
      }),
      { numRuns: 100 }
    );
  });

  it('verifyInternalToken throws when verified with a different secret', async () => {
    await fc.assert(
      fc.asyncProperty(
        serviceNameArb,
        secretArb,
        // Generate a different secret (guaranteed distinct from the first)
        fc.string({ minLength: 32, maxLength: 64 }).filter((s) => Buffer.byteLength(s, 'utf-8') >= 32),
        async (serviceName, secret, wrongSecret) => {
          // Skip if the two secrets happen to be identical
          fc.pre(secret !== wrongSecret);

          const token = createInternalToken(serviceName, secret);

          await expect(verifyInternalToken(token, wrongSecret)).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});
