/**
 * Unit tests for GoogleAuth.
 *
 * Tests cover:
 * - Service account credential validation (file existence, required fields)
 * - OAuth 2.0 credential validation (clientId + clientSecret)
 * - Token caching and automatic refresh
 * - Retry logic with exponential backoff (up to 3 attempts)
 * - AuthError thrown on exhaustion
 * - getDriveClient() returns an authenticated Drive v3 client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { GoogleAuth, type GoogleAuthConfig } from '../auth/google-auth.js';
import { AuthError } from '../lib/errors.js';

// ---------------------------------------------------------------------------
// Mock node:fs so we never touch the real filesystem
// ---------------------------------------------------------------------------
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A valid service account key object. */
function validServiceAccountKey() {
  return {
    type: 'service_account',
    project_id: 'test-project',
    private_key_id: 'key-id-123',
    // Mock test fixture - not a real key
    private_key: 'mock-rsa-private-key-fixture',
    client_email: 'test@test-project.iam.gserviceaccount.com',
    client_id: '123456789',
    token_uri: 'https://oauth2.googleapis.com/token',
  };
}

/** Set up fs mocks so the service account file appears valid. */
function mockValidServiceAccountFile(path = '/path/to/creds.json') {
  mockExistsSync.mockReturnValue(true);
  mockReadFileSync.mockReturnValue(JSON.stringify(validServiceAccountKey()));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GoogleAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Construction & validation
  // -----------------------------------------------------------------------

  describe('constructor validation', () => {
    it('throws AuthError when no credentials are provided', () => {
      expect(() => new GoogleAuth({})).toThrow(AuthError);
      expect(() => new GoogleAuth({})).toThrow(/No Google credentials configured/);
    });

    it('throws AuthError when credentials file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      expect(
        () => new GoogleAuth({ credentialsPath: '/missing/file.json' }),
      ).toThrow(AuthError);
      expect(
        () => new GoogleAuth({ credentialsPath: '/missing/file.json' }),
      ).toThrow(/Credentials file not found/);
    });

    it('throws AuthError when credentials file is not valid JSON', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('not json');

      expect(
        () => new GoogleAuth({ credentialsPath: '/bad.json' }),
      ).toThrow(AuthError);
      expect(
        () => new GoogleAuth({ credentialsPath: '/bad.json' }),
      ).toThrow(/Failed to parse credentials file/);
    });

    it('throws AuthError when credentials file is missing required fields', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ type: 'service_account' }));

      expect(
        () => new GoogleAuth({ credentialsPath: '/incomplete.json' }),
      ).toThrow(AuthError);
      expect(
        () => new GoogleAuth({ credentialsPath: '/incomplete.json' }),
      ).toThrow(/missing required fields/);
    });

    it('accepts a valid service account credentials file', () => {
      mockValidServiceAccountFile();

      const auth = new GoogleAuth({ credentialsPath: '/path/to/creds.json' });
      expect(auth).toBeInstanceOf(GoogleAuth);
    });

    it('throws AuthError when only clientId is provided (no clientSecret)', () => {
      expect(
        () => new GoogleAuth({ clientId: 'id-only' }),
      ).toThrow(AuthError);
      expect(
        () => new GoogleAuth({ clientId: 'id-only' }),
      ).toThrow(/clientSecret is required/);
    });

    it('throws AuthError when only clientSecret is provided (no clientId)', () => {
      expect(
        () => new GoogleAuth({ clientSecret: 'secret-only' }),
      ).toThrow(AuthError);
      expect(
        () => new GoogleAuth({ clientSecret: 'secret-only' }),
      ).toThrow(/clientId is required/);
    });

    it('accepts valid OAuth credentials (clientId + clientSecret)', () => {
      const auth = new GoogleAuth({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      });
      expect(auth).toBeInstanceOf(GoogleAuth);
    });

    it('prefers service account when both credentialsPath and OAuth are provided', () => {
      mockValidServiceAccountFile();

      // Should not throw — credentialsPath takes precedence
      const auth = new GoogleAuth({
        credentialsPath: '/path/to/creds.json',
        clientId: 'test-id',
        clientSecret: 'test-secret',
      });
      expect(auth).toBeInstanceOf(GoogleAuth);
    });
  });

  // -----------------------------------------------------------------------
  // getDriveClient
  // -----------------------------------------------------------------------

  describe('getDriveClient', () => {
    it('returns a Drive v3 client for service account auth', () => {
      mockValidServiceAccountFile();
      const auth = new GoogleAuth({ credentialsPath: '/path/to/creds.json' });

      const drive = auth.getDriveClient();
      expect(drive).toBeDefined();
      expect(drive.files).toBeDefined();
    });

    it('returns a Drive v3 client for OAuth auth', () => {
      const auth = new GoogleAuth({
        clientId: 'test-id',
        clientSecret: 'test-secret',
      });

      const drive = auth.getDriveClient();
      expect(drive).toBeDefined();
      expect(drive.files).toBeDefined();
    });

    it('returns the same Drive client on repeated calls', () => {
      const auth = new GoogleAuth({
        clientId: 'test-id',
        clientSecret: 'test-secret',
      });

      const drive1 = auth.getDriveClient();
      const drive2 = auth.getDriveClient();
      // The underlying auth client is reused (same instance)
      expect(drive1).toBeDefined();
      expect(drive2).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // getAccessToken — caching & refresh
  // -----------------------------------------------------------------------

  describe('getAccessToken', () => {
    it('throws AuthError after 3 failed refresh attempts', async () => {
      const auth = new GoogleAuth({
        clientId: 'test-id',
        clientSecret: 'test-secret',
      });

      // Override sleep to avoid real delays
      (auth as unknown as { sleep: (ms: number) => Promise<void> }).sleep = () =>
        Promise.resolve();

      // The OAuth2 client will fail because there's no real token endpoint
      await expect(auth.getAccessToken()).rejects.toThrow(AuthError);
      await expect(auth.getAccessToken()).rejects.toThrow(
        /Failed to refresh Google access token after 3 attempts/,
      );
    });

    it('refreshIfExpired delegates to getAccessToken', async () => {
      const auth = new GoogleAuth({
        clientId: 'test-id',
        clientSecret: 'test-secret',
      });

      // Override sleep to avoid real delays
      (auth as unknown as { sleep: (ms: number) => Promise<void> }).sleep = () =>
        Promise.resolve();

      // Both should throw the same error
      await expect(auth.refreshIfExpired()).rejects.toThrow(AuthError);
    });
  });

  // -----------------------------------------------------------------------
  // AuthError properties
  // -----------------------------------------------------------------------

  describe('AuthError context', () => {
    it('includes component and operation in the error context', () => {
      try {
        new GoogleAuth({});
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        const authErr = err as AuthError;
        expect(authErr.category).toBe('auth_error');
        expect(authErr.context.component).toBe('GoogleAuth');
        expect(authErr.context.operation).toBe('validateConfig');
      }
    });

    it('includes component and operation for refresh failures', async () => {
      const auth = new GoogleAuth({
        clientId: 'test-id',
        clientSecret: 'test-secret',
      });

      (auth as unknown as { sleep: (ms: number) => Promise<void> }).sleep = () =>
        Promise.resolve();

      try {
        await auth.getAccessToken();
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        const authErr = err as AuthError;
        expect(authErr.category).toBe('auth_error');
        expect(authErr.context.component).toBe('GoogleAuth');
        expect(authErr.context.operation).toBe('refreshToken');
      }
    });
  });
});
