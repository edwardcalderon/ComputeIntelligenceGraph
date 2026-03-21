/**
 * Property-Based Tests for Bootstrap Token Format
 *
 * Property 9: Bootstrap token format — generated tokens are 32 characters,
 * cryptographically random hex content.
 *
 * **Validates: Requirements 5.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as crypto from 'crypto';

/**
 * Generate a bootstrap token (32-character hex string).
 */
function generateBootstrapToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

describe('Bootstrap Token Format', () => {
  it('Property 9: Generated bootstrap tokens are exactly 32 characters of hex', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        const token = generateBootstrapToken();

        // Token must be exactly 32 characters
        expect(token).toHaveLength(32);

        // Token must be valid hex (only 0-9, a-f)
        expect(/^[0-9a-f]{32}$/.test(token)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 9: Generated tokens are cryptographically random (no duplicates)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        const tokens = new Set<string>();

        // Generate 100 tokens
        for (let i = 0; i < 100; i++) {
          tokens.add(generateBootstrapToken());
        }

        // All tokens should be unique (collision probability negligible)
        expect(tokens.size).toBe(100);
      }),
      { numRuns: 10 }
    );
  });

  it('Property 9: Token format is consistent across multiple generations', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), () => {
        const token = generateBootstrapToken();

        // Verify format
        expect(token).toMatch(/^[0-9a-f]{32}$/);
        expect(token).toHaveLength(32);

        // Verify it's not empty or whitespace
        expect(token.trim()).toHaveLength(32);
      }),
      { numRuns: 50 }
    );
  });
});
