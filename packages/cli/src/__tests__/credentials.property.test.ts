/**
 * Property-Based Tests for CredentialManager
 *
 * Property 5: Token storage round trip
 * Property 6: Token refresh predicate correctness
 *
 * Validates: Requirements 3.5, 3.9
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CredentialManager, AuthTokens } from '../credentials.js';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates a hex string of specified length.
 */
const hexStringArb = (length: number) =>
  fc.stringOf(fc.constantFrom(...'0123456789abcdef'.split('')), {
    minLength: length,
    maxLength: length,
  });

/**
 * Generates realistic auth tokens with various expiry times.
 */
const authTokensArb = fc
  .tuple(
    hexStringArb(32), // accessToken
    hexStringArb(32), // refreshToken
    fc.integer({ min: 0, max: 86400000 }), // expiresAt offset from now (0 to 24 hours)
    fc.integer({ min: 0, max: 604800000 }) // refreshExpiresAt offset from now (0 to 7 days)
  )
  .map(([accessToken, refreshToken, expiresAtOffset, refreshExpiresAtOffset]) => ({
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresAtOffset,
    refreshExpiresAt: Date.now() + refreshExpiresAtOffset,
  }));

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 5: Token storage round trip', () => {
  let tmpDir: string;
  let manager: CredentialManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cig-test-'));
    manager = new CredentialManager({
      paths: {
        configDir: path.join(tmpDir, 'config'),
      },
      encryptionSeed: 'test-seed',
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('tokens stored via saveTokens() can be retrieved and match original values', () => {
    /**
     * Validates: Requirements 3.5
     *
     * For any AuthTokens value, storing it via CredentialManager.saveTokens()
     * and then loading it via loadTokens() should return an equivalent value.
     */
    fc.assert(
      fc.property(authTokensArb, (originalTokens) => {
        // Save the tokens
        manager.saveTokens(originalTokens);

        // Load them back
        const loadedTokens = manager.loadTokens();

        // Verify they match
        expect(loadedTokens).not.toBeNull();
        expect(loadedTokens?.accessToken).toBe(originalTokens.accessToken);
        expect(loadedTokens?.refreshToken).toBe(originalTokens.refreshToken);
        expect(loadedTokens?.expiresAt).toBe(originalTokens.expiresAt);
        expect(loadedTokens?.refreshExpiresAt).toBe(originalTokens.refreshExpiresAt);
      }),
      { numRuns: 100 }
    );
  });

  it('multiple save/load cycles preserve token integrity', () => {
    /**
     * Validates: Requirements 3.5
     *
     * For any sequence of token saves and loads, the final loaded value
     * should match the last saved value.
     */
    fc.assert(
      fc.property(fc.array(authTokensArb, { minLength: 1, maxLength: 5 }), (tokenSequence) => {
        // Save all tokens in sequence
        for (const tokens of tokenSequence) {
          manager.saveTokens(tokens);
        }

        // Load and verify it matches the last saved
        const lastTokens = tokenSequence[tokenSequence.length - 1];
        const loadedTokens = manager.loadTokens();

        expect(loadedTokens).not.toBeNull();
        expect(loadedTokens?.accessToken).toBe(lastTokens.accessToken);
        expect(loadedTokens?.refreshToken).toBe(lastTokens.refreshToken);
        expect(loadedTokens?.expiresAt).toBe(lastTokens.expiresAt);
        expect(loadedTokens?.refreshExpiresAt).toBe(lastTokens.refreshExpiresAt);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 6: Token refresh predicate correctness', () => {
  let tmpDir: string;
  let manager: CredentialManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cig-test-'));
    manager = new CredentialManager({
      paths: {
        configDir: path.join(tmpDir, 'config'),
      },
      encryptionSeed: 'test-seed',
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('needsRefresh() returns true when expiresAt < now + 5 minutes', () => {
    /**
     * Validates: Requirements 3.9
     *
     * For any AuthTokens where expiresAt < Date.now() + 5 * 60 * 1000,
     * CredentialManager.needsRefresh() should return true.
     */
    fc.assert(
      fc.property(
        fc
          .tuple(
            hexStringArb(32),
            hexStringArb(32),
            fc.integer({ min: 0, max: 299999 }), // 0 to ~5 minutes
            fc.integer({ min: 300000, max: 604800000 })
          )
          .map(([accessToken, refreshToken, expiresAtOffset, refreshExpiresAtOffset]) => ({
            accessToken,
            refreshToken,
            expiresAt: Date.now() + expiresAtOffset,
            refreshExpiresAt: Date.now() + refreshExpiresAtOffset,
          })),
        (tokens) => {
          const result = manager.needsRefresh(tokens);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('needsRefresh() returns false when expiresAt >= now + 5 minutes', () => {
    /**
     * Validates: Requirements 3.9
     *
     * For any AuthTokens where expiresAt >= Date.now() + 5 * 60 * 1000,
     * CredentialManager.needsRefresh() should return false.
     */
    fc.assert(
      fc.property(
        fc
          .tuple(
            hexStringArb(32),
            hexStringArb(32),
            fc.integer({ min: 300000, max: 86400000 }), // >= 5 minutes
            fc.integer({ min: 300000, max: 604800000 })
          )
          .map(([accessToken, refreshToken, expiresAtOffset, refreshExpiresAtOffset]) => ({
            accessToken,
            refreshToken,
            expiresAt: Date.now() + expiresAtOffset,
            refreshExpiresAt: Date.now() + refreshExpiresAtOffset,
          })),
        (tokens) => {
          const result = manager.needsRefresh(tokens);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('needsRefresh() boundary: exactly at 5 minute threshold', () => {
    /**
     * Validates: Requirements 3.9
     *
     * Edge case: when expiresAt is exactly at the 5-minute boundary,
     * needsRefresh() should return false (>= comparison).
     */
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      const fiveMinutesMs = 5 * 60 * 1000;
      const tokens: AuthTokens = {
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        expiresAt: now + fiveMinutesMs,
        refreshExpiresAt: now + 86400000,
      };

      const result = manager.needsRefresh(tokens);
      expect(result).toBe(false);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('needsRefresh() boundary: just before 5 minute threshold', () => {
    /**
     * Validates: Requirements 3.9
     *
     * Edge case: when expiresAt is just before the 5-minute boundary,
     * needsRefresh() should return true.
     */
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      const fiveMinutesMs = 5 * 60 * 1000;
      const tokens: AuthTokens = {
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        expiresAt: now + fiveMinutesMs - 1,
        refreshExpiresAt: now + 86400000,
      };

      const result = manager.needsRefresh(tokens);
      expect(result).toBe(true);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('needsRefresh() with expired tokens', () => {
    /**
     * Validates: Requirements 3.9
     *
     * For tokens that are already expired (expiresAt in the past),
     * needsRefresh() should return true.
     */
    const tokens: AuthTokens = {
      accessToken: 'test-access',
      refreshToken: 'test-refresh',
      expiresAt: Date.now() - 3600000, // 1 hour ago
      refreshExpiresAt: Date.now() + 86400000,
    };

    const result = manager.needsRefresh(tokens);
    expect(result).toBe(true);
  });
});
