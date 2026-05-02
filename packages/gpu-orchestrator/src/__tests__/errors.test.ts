import { describe, it, expect } from 'vitest';
import {
  OrchestratorError,
  AuthError,
  ProviderError,
  OllamaError,
  StateStoreError,
  ConfigError,
  type ErrorCategory,
  type ErrorContext,
} from '../lib/errors.js';

describe('OrchestratorError', () => {
  it('sets message, category, and context', () => {
    const ctx: ErrorContext = { component: 'test', sessionId: 's1', operation: 'op' };
    const err = new OrchestratorError('boom', 'provider_error', ctx);

    expect(err.message).toBe('boom');
    expect(err.category).toBe('provider_error');
    expect(err.context).toEqual(ctx);
    expect(err.name).toBe('OrchestratorError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(OrchestratorError);
  });

  it('defaults context to empty object', () => {
    const err = new OrchestratorError('no ctx', 'config_error');
    expect(err.context).toEqual({});
  });

  it('has a stack trace', () => {
    const err = new OrchestratorError('trace', 'auth_error');
    expect(err.stack).toBeDefined();
  });
});

describe('AuthError', () => {
  it('has category auth_error', () => {
    const err = new AuthError('token expired', { component: 'google-auth' });
    expect(err.category).toBe('auth_error' satisfies ErrorCategory);
    expect(err.name).toBe('AuthError');
    expect(err).toBeInstanceOf(AuthError);
    expect(err).toBeInstanceOf(OrchestratorError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('ProviderError', () => {
  it('has category provider_error', () => {
    const err = new ProviderError('colab timeout', { sessionId: 'abc' });
    expect(err.category).toBe('provider_error' satisfies ErrorCategory);
    expect(err.name).toBe('ProviderError');
    expect(err).toBeInstanceOf(ProviderError);
    expect(err).toBeInstanceOf(OrchestratorError);
  });
});

describe('OllamaError', () => {
  it('has category ollama_error', () => {
    const err = new OllamaError('model pull failed', { operation: 'pull' });
    expect(err.category).toBe('ollama_error' satisfies ErrorCategory);
    expect(err.name).toBe('OllamaError');
    expect(err).toBeInstanceOf(OllamaError);
    expect(err).toBeInstanceOf(OrchestratorError);
  });
});

describe('StateStoreError', () => {
  it('has category state_store_error', () => {
    const err = new StateStoreError('dynamo write failed');
    expect(err.category).toBe('state_store_error' satisfies ErrorCategory);
    expect(err.name).toBe('StateStoreError');
    expect(err).toBeInstanceOf(StateStoreError);
    expect(err).toBeInstanceOf(OrchestratorError);
  });
});

describe('ConfigError', () => {
  it('has category config_error', () => {
    const err = new ConfigError('missing GPU_ORCH_PROVIDER');
    expect(err.category).toBe('config_error' satisfies ErrorCategory);
    expect(err.name).toBe('ConfigError');
    expect(err).toBeInstanceOf(ConfigError);
    expect(err).toBeInstanceOf(OrchestratorError);
  });
});

describe('ErrorContext', () => {
  it('supports arbitrary extra keys', () => {
    const err = new OrchestratorError('extra', 'provider_error', {
      component: 'colab',
      retryCount: 3,
      fileId: 'abc123',
    });
    expect(err.context.component).toBe('colab');
    expect(err.context.retryCount).toBe(3);
    expect(err.context.fileId).toBe('abc123');
  });
});
