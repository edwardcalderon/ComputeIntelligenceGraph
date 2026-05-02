/**
 * Unit tests for the configuration loader and schemas.
 *
 * Tests cover: loadConfig(), redactConfig(), env var mapping,
 * validation error reporting, and default values.
 */

import { describe, it, expect } from 'vitest';
import { loadConfig, redactConfig } from '../config/loader.js';
import { ConfigError } from '../lib/errors.js';

/** Minimal valid env that satisfies all required fields. */
function validEnv(): Record<string, string> {
  return {
    GPU_ORCH_MODEL_NAMES: 'llama3',
    GPU_ORCH_REQUEST_QUEUE_URL: 'https://sqs.us-east-2.amazonaws.com/123/req',
    GPU_ORCH_RESPONSE_QUEUE_URL: 'https://sqs.us-east-2.amazonaws.com/123/res',
  };
}

describe('loadConfig', () => {
  it('loads a minimal valid configuration with defaults', () => {
    const config = loadConfig(validEnv());

    expect(config.provider).toBe('colab');
    expect(config.modelNames).toEqual(['llama3']);
    expect(config.awsRegion).toBe('us-east-2');
    expect(config.dynamoTableName).toBe('llm-proxy-state');
    expect(config.healthCheckIntervalMs).toBe(60_000);
    expect(config.healthEndpointPort).toBe(8787);
    expect(config.heartbeatThresholdSeconds).toBe(180);
    expect(config.logLevel).toBe('info');
    expect(config.googleCredentialsPath).toBeUndefined();
    expect(config.googleOAuthClientId).toBeUndefined();
    expect(config.googleOAuthClientSecret).toBeUndefined();
  });

  it('loads all explicit values overriding defaults', () => {
    const env: Record<string, string> = {
      GPU_ORCH_PROVIDER: 'local',
      GPU_ORCH_MODEL_NAMES: 'llama3,codellama',
      GPU_ORCH_GOOGLE_CREDS_PATH: '/path/to/creds.json',
      GPU_ORCH_GOOGLE_CLIENT_ID: 'client-id-123',
      GPU_ORCH_GOOGLE_CLIENT_SECRET: 'secret-456',
      GPU_ORCH_AWS_REGION: 'eu-west-1',
      GPU_ORCH_REQUEST_QUEUE_URL: 'https://sqs.eu-west-1.amazonaws.com/123/req',
      GPU_ORCH_RESPONSE_QUEUE_URL: 'https://sqs.eu-west-1.amazonaws.com/123/res',
      GPU_ORCH_DYNAMO_TABLE: 'custom-table',
      GPU_ORCH_HEALTH_INTERVAL: '30000',
      GPU_ORCH_HEALTH_PORT: '9090',
      GPU_ORCH_HEARTBEAT_THRESHOLD: '300',
      GPU_ORCH_LOG_LEVEL: 'debug',
    };

    const config = loadConfig(env);

    expect(config.provider).toBe('local');
    expect(config.modelNames).toEqual(['llama3', 'codellama']);
    expect(config.googleCredentialsPath).toBe('/path/to/creds.json');
    expect(config.googleOAuthClientId).toBe('client-id-123');
    expect(config.googleOAuthClientSecret).toBe('secret-456');
    expect(config.awsRegion).toBe('eu-west-1');
    expect(config.requestQueueUrl).toBe('https://sqs.eu-west-1.amazonaws.com/123/req');
    expect(config.responseQueueUrl).toBe('https://sqs.eu-west-1.amazonaws.com/123/res');
    expect(config.dynamoTableName).toBe('custom-table');
    expect(config.healthCheckIntervalMs).toBe(30_000);
    expect(config.healthEndpointPort).toBe(9090);
    expect(config.heartbeatThresholdSeconds).toBe(300);
    expect(config.logLevel).toBe('debug');
  });

  it('splits comma-separated model names', () => {
    const env = {
      ...validEnv(),
      GPU_ORCH_MODEL_NAMES: 'a,b,c',
    };
    const config = loadConfig(env);
    expect(config.modelNames).toEqual(['a', 'b', 'c']);
  });

  it('coerces numeric string values to numbers', () => {
    const env = {
      ...validEnv(),
      GPU_ORCH_HEALTH_INTERVAL: '5000',
      GPU_ORCH_HEALTH_PORT: '3000',
      GPU_ORCH_HEARTBEAT_THRESHOLD: '60',
    };
    const config = loadConfig(env);
    expect(config.healthCheckIntervalMs).toBe(5000);
    expect(config.healthEndpointPort).toBe(3000);
    expect(config.heartbeatThresholdSeconds).toBe(60);
  });

  it('throws ConfigError when required fields are missing', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
  });

  it('reports all validation errors, not just the first', () => {
    try {
      loadConfig({
        GPU_ORCH_PROVIDER: 'invalid-provider',
        GPU_ORCH_REQUEST_QUEUE_URL: 'not-a-url',
        GPU_ORCH_RESPONSE_QUEUE_URL: 'also-not-a-url',
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const message = (err as ConfigError).message;
      // Should mention multiple issues
      expect(message).toContain('provider');
      expect(message).toContain('requestQueueUrl');
      expect(message).toContain('responseQueueUrl');
      expect(message).toContain('modelNames');
    }
  });

  it('throws ConfigError with config_error category', () => {
    try {
      loadConfig({});
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).category).toBe('config_error');
      expect((err as ConfigError).context.component).toBe('ConfigLoader');
    }
  });

  it('ignores non-GPU_ORCH_ environment variables', () => {
    const env = {
      ...validEnv(),
      HOME: '/home/user',
      PATH: '/usr/bin',
      AWS_REGION: 'us-west-2',
    };
    const config = loadConfig(env);
    // AWS_REGION without GPU_ORCH_ prefix should not affect awsRegion
    expect(config.awsRegion).toBe('us-east-2');
  });

  it('ignores unknown GPU_ORCH_ suffixes', () => {
    const env = {
      ...validEnv(),
      GPU_ORCH_UNKNOWN_FIELD: 'some-value',
    };
    // Should not throw
    const config = loadConfig(env);
    expect(config.provider).toBe('colab');
  });

  it('rejects invalid provider value', () => {
    const env = {
      ...validEnv(),
      GPU_ORCH_PROVIDER: 'kaggle',
    };
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });

  it('rejects invalid URL for queue URLs', () => {
    const env = {
      ...validEnv(),
      GPU_ORCH_REQUEST_QUEUE_URL: 'not-a-url',
    };
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });
});

describe('redactConfig', () => {
  it('replaces sensitive fields with ***', () => {
    const config = loadConfig({
      ...validEnv(),
      GPU_ORCH_GOOGLE_CREDS_PATH: '/secret/path',
      GPU_ORCH_GOOGLE_CLIENT_ID: 'my-client-id',
      GPU_ORCH_GOOGLE_CLIENT_SECRET: 'my-secret',
    });

    const redacted = redactConfig(config);

    expect(redacted.googleCredentialsPath).toBe('***');
    expect(redacted.googleOAuthClientId).toBe('***');
    expect(redacted.googleOAuthClientSecret).toBe('***');
  });

  it('preserves non-sensitive field values as strings', () => {
    const config = loadConfig(validEnv());
    const redacted = redactConfig(config);

    expect(redacted.provider).toBe('colab');
    expect(redacted.awsRegion).toBe('us-east-2');
    expect(redacted.requestQueueUrl).toBe('https://sqs.us-east-2.amazonaws.com/123/req');
    expect(redacted.dynamoTableName).toBe('llm-proxy-state');
    expect(redacted.healthCheckIntervalMs).toBe('60000');
    expect(redacted.healthEndpointPort).toBe('8787');
    expect(redacted.heartbeatThresholdSeconds).toBe('180');
    expect(redacted.logLevel).toBe('info');
  });

  it('joins array values with commas', () => {
    const config = loadConfig({
      ...validEnv(),
      GPU_ORCH_MODEL_NAMES: 'llama3,codellama',
    });
    const redacted = redactConfig(config);
    expect(redacted.modelNames).toBe('llama3,codellama');
  });

  it('redacts sensitive fields even when undefined by setting ***', () => {
    const config = loadConfig(validEnv());
    const redacted = redactConfig(config);

    // Optional fields that are undefined should still be redacted
    expect(redacted.googleCredentialsPath).toBe('***');
    expect(redacted.googleOAuthClientId).toBe('***');
    expect(redacted.googleOAuthClientSecret).toBe('***');
  });
});
