/**
 * Integration tests for provider factory and auth flows.
 *
 * Tests cover:
 * 1. Provider factory creates correct provider type (colab, local)
 * 2. Credentials file validation at startup (missing, invalid JSON, missing fields)
 * 3. OAuth requires both clientId and clientSecret
 * 4. Provider factory throws ConfigError for unknown provider type
 *
 * Validates: Requirements 2.1, 2.2, 2.4, 7.1, 7.2, 7.3, 7.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { createProvider } from '../providers/factory.js';
import { ColabProvider } from '../providers/colab-provider.js';
import { LocalProvider } from '../providers/local-provider.js';
import { GoogleAuth } from '../auth/google-auth.js';
import { AuthError, ConfigError } from '../lib/errors.js';
import { Logger } from '../lib/logger.js';
import type { OrchestratorConfig } from '../config/schemas.js';

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

/** Silent logger that suppresses all output during tests. */
function createSilentLogger(): Logger {
  return new Logger({
    component: 'provider-auth-integration-test',
    sessionId: 'test-session',
    writer: () => {},
  });
}

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
function mockValidServiceAccountFile() {
  mockExistsSync.mockReturnValue(true);
  mockReadFileSync.mockReturnValue(JSON.stringify(validServiceAccountKey()));
}

/** Minimal valid OrchestratorConfig for testing. */
function createTestConfig(
  overrides: Partial<OrchestratorConfig> = {},
): OrchestratorConfig {
  return {
    provider: 'local',
    modelNames: ['llama3'],
    awsRegion: 'us-east-2',
    requestQueueUrl: 'https://sqs.us-east-2.amazonaws.com/123456789/req',
    responseQueueUrl: 'https://sqs.us-east-2.amazonaws.com/123456789/res',
    dynamoTableName: 'llm-proxy-state',
    healthCheckIntervalMs: 60_000,
    healthEndpointPort: 8787,
    heartbeatThresholdSeconds: 180,
    logLevel: 'info',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: provider factory and auth flows', () => {
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createSilentLogger();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. Provider factory creates correct provider type
  // Validates: Requirements 2.1, 2.2
  // -----------------------------------------------------------------------

  describe('Provider factory creates correct provider type', () => {
    it('creates a LocalProvider when config.provider is "local"', () => {
      const config = createTestConfig({ provider: 'local' });
      const provider = createProvider(config, logger);

      expect(provider).toBeInstanceOf(LocalProvider);
      expect(provider.providerName).toBe('local');
    });

    it('creates a ColabProvider when config.provider is "colab" with valid service account credentials', () => {
      mockValidServiceAccountFile();

      const config = createTestConfig({
        provider: 'colab',
        googleCredentialsPath: '/path/to/creds.json',
      });
      const provider = createProvider(config, logger);

      expect(provider).toBeInstanceOf(ColabProvider);
      expect(provider.providerName).toBe('colab');
    });

    it('creates a ColabProvider when config.provider is "colab" with OAuth credentials', () => {
      const config = createTestConfig({
        provider: 'colab',
        googleOAuthClientId: 'test-client-id',
        googleOAuthClientSecret: 'test-client-secret',
      });
      const provider = createProvider(config, logger);

      expect(provider).toBeInstanceOf(ColabProvider);
      expect(provider.providerName).toBe('colab');
    });
  });

  // -----------------------------------------------------------------------
  // 2. Provider factory throws ConfigError for unknown provider
  // Validates: Requirements 1.3, 1.4
  // -----------------------------------------------------------------------

  describe('Provider factory throws ConfigError for unknown provider', () => {
    it('throws ConfigError when provider type is unrecognised', () => {
      // Force an invalid provider value by casting
      const config = createTestConfig({
        provider: 'kaggle' as OrchestratorConfig['provider'],
      });

      expect(() => createProvider(config, logger)).toThrow(ConfigError);
      expect(() => createProvider(config, logger)).toThrow(
        /Unknown provider type/,
      );
    });

    it('ConfigError includes component and operation context', () => {
      const config = createTestConfig({
        provider: 'unknown' as OrchestratorConfig['provider'],
      });

      try {
        createProvider(config, logger);
        expect.fail('Expected ConfigError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        const configErr = err as ConfigError;
        expect(configErr.category).toBe('config_error');
        expect(configErr.context.component).toBe('ProviderFactory');
        expect(configErr.context.operation).toBe('createProvider');
      }
    });
  });

  // -----------------------------------------------------------------------
  // 3. Credentials file validation at startup
  // Validates: Requirements 7.1, 7.6
  // -----------------------------------------------------------------------

  describe('Credentials file validation at startup', () => {
    it('throws AuthError when credentials file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const config = createTestConfig({
        provider: 'colab',
        googleCredentialsPath: '/nonexistent/creds.json',
      });

      expect(() => createProvider(config, logger)).toThrow(AuthError);
      expect(() => createProvider(config, logger)).toThrow(
        /Credentials file not found/,
      );
    });

    it('throws AuthError when credentials file contains invalid JSON', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{ this is not valid json }');

      const config = createTestConfig({
        provider: 'colab',
        googleCredentialsPath: '/bad/creds.json',
      });

      expect(() => createProvider(config, logger)).toThrow(AuthError);
      expect(() => createProvider(config, logger)).toThrow(
        /Failed to parse credentials file/,
      );
    });

    it('throws AuthError when credentials file is missing required fields', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ type: 'service_account' }),
      );

      const config = createTestConfig({
        provider: 'colab',
        googleCredentialsPath: '/incomplete/creds.json',
      });

      expect(() => createProvider(config, logger)).toThrow(AuthError);
      expect(() => createProvider(config, logger)).toThrow(
        /missing required fields/,
      );
    });

    it('lists all missing fields in the error message', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({}));

      try {
        new GoogleAuth({ credentialsPath: '/empty/creds.json' });
        expect.fail('Expected AuthError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        const authErr = err as AuthError;
        // All required fields should be listed
        expect(authErr.message).toContain('type');
        expect(authErr.message).toContain('project_id');
        expect(authErr.message).toContain('private_key');
        expect(authErr.message).toContain('client_email');
        expect(authErr.message).toContain('token_uri');
      }
    });
  });

  // -----------------------------------------------------------------------
  // 4. OAuth requires both clientId and clientSecret
  // Validates: Requirements 7.2, 7.3
  // -----------------------------------------------------------------------

  describe('OAuth requires both clientId and clientSecret', () => {
    it('throws AuthError when only clientId is provided via factory', () => {
      const config = createTestConfig({
        provider: 'colab',
        googleOAuthClientId: 'only-client-id',
      });

      expect(() => createProvider(config, logger)).toThrow(AuthError);
      expect(() => createProvider(config, logger)).toThrow(
        /clientSecret is required/,
      );
    });

    it('throws AuthError when only clientSecret is provided via factory', () => {
      const config = createTestConfig({
        provider: 'colab',
        googleOAuthClientSecret: 'only-client-secret',
      });

      expect(() => createProvider(config, logger)).toThrow(AuthError);
      expect(() => createProvider(config, logger)).toThrow(
        /clientId is required/,
      );
    });

    it('throws AuthError when colab provider has no credentials at all', () => {
      const config = createTestConfig({
        provider: 'colab',
        // No googleCredentialsPath, no clientId, no clientSecret
      });

      expect(() => createProvider(config, logger)).toThrow(AuthError);
      expect(() => createProvider(config, logger)).toThrow(
        /No Google credentials configured/,
      );
    });
  });
});
