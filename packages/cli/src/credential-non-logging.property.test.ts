/**
 * Property 20: Credential Non-Logging
 * Validates: Requirements 15.4
 *
 * For any credential string, it never appears in console.log output.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CredentialManager } from './credentials';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates realistic credential strings: API keys, tokens, secrets.
 */
const credentialArb = fc.oneof(
  // AWS-style access key
  fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), {
    minLength: 20,
    maxLength: 40,
  }),
  // Generic secret token
  fc.base64String({ minLength: 16, maxLength: 64 }),
  // Alphanumeric password
  fc.string({ minLength: 8, maxLength: 50 }).filter((s) => s.trim().length > 0),
);

const credTypeArb = fc.constantFrom('aws' as const, 'gcp' as const);

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 20: Credential Non-Logging', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let tmpDir: string;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Use a temp directory to avoid touching real ~/.cig
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cig-test-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up temp dir
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('credential value never appears in console.log output during save()', () => {
    /**
     * Validates: Requirements 15.4
     * For any credential string, calling save() must not log the raw
     * credential value to console.log.
     */
    fc.assert(
      fc.property(credentialArb, credTypeArb, (credValue, credType) => {
        // Patch the config dir to use our temp directory
        const manager = new CredentialManager();
        (manager as unknown as { configDir: string }).configDir = tmpDir;
        (manager as unknown as { configFile: string }).configFile = path.join(tmpDir, 'config.json');

        try {
          manager.save(credType, credValue);
        } catch {
          // Ignore errors (e.g. encryption issues in test env)
        }

        // Check that none of the console.log calls contain the raw credential
        const allLoggedArgs = logSpy.mock.calls.flat().map(String);
        for (const logged of allLoggedArgs) {
          expect(logged).not.toContain(credValue);
        }

        logSpy.mockClear();
      }),
      { numRuns: 50 }
    );
  });

  it('credential value never appears in console.log output during delete()', () => {
    /**
     * Validates: Requirements 15.4
     * Deleting a credential must not log the credential value.
     */
    fc.assert(
      fc.property(credentialArb, credTypeArb, (credValue, credType) => {
        const manager = new CredentialManager();
        (manager as unknown as { configDir: string }).configDir = tmpDir;
        (manager as unknown as { configFile: string }).configFile = path.join(tmpDir, 'config.json');

        // Save first (ignore errors), then delete
        try {
          manager.save(credType, credValue);
          logSpy.mockClear();
          manager.delete(credType);
        } catch {
          // ignore
        }

        const allLoggedArgs = logSpy.mock.calls.flat().map(String);
        for (const logged of allLoggedArgs) {
          expect(logged).not.toContain(credValue);
        }

        logSpy.mockClear();
      }),
      { numRuns: 50 }
    );
  });

  it('credential value never appears in console.log output during load()', () => {
    /**
     * Validates: Requirements 15.4
     * Loading a credential must not log the raw credential value.
     */
    fc.assert(
      fc.property(credentialArb, credTypeArb, (credValue, credType) => {
        const manager = new CredentialManager();
        (manager as unknown as { configDir: string }).configDir = tmpDir;
        (manager as unknown as { configFile: string }).configFile = path.join(tmpDir, 'config.json');

        try {
          manager.save(credType, credValue);
          logSpy.mockClear();
          manager.load(credType);
        } catch {
          // ignore
        }

        const allLoggedArgs = logSpy.mock.calls.flat().map(String);
        for (const logged of allLoggedArgs) {
          expect(logged).not.toContain(credValue);
        }

        logSpy.mockClear();
      }),
      { numRuns: 50 }
    );
  });
});
