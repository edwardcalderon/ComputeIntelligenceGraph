/**
 * Typed error classes for the GPU Orchestrator.
 *
 * Each error carries a `category` field for structured classification
 * and a `context` record for structured metadata (component, sessionId, operation).
 *
 * @module
 */

/** Error categories used for structured error classification. */
export type ErrorCategory =
  | 'auth_error'
  | 'provider_error'
  | 'ollama_error'
  | 'state_store_error'
  | 'config_error';

/** Structured metadata attached to every OrchestratorError. */
export interface ErrorContext {
  component?: string;
  sessionId?: string;
  operation?: string;
  [key: string]: unknown;
}

/**
 * Base error class for all orchestrator errors.
 * Extends the built-in `Error` with a typed `category` and structured `context`.
 */
export class OrchestratorError extends Error {
  public readonly category: ErrorCategory;
  public readonly context: ErrorContext;

  constructor(
    message: string,
    category: ErrorCategory,
    context: ErrorContext = {},
  ) {
    super(message);
    this.name = 'OrchestratorError';
    this.category = category;
    this.context = context;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Authentication failures (Google OAuth / Service Account). */
export class AuthError extends OrchestratorError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, 'auth_error', context);
    this.name = 'AuthError';
  }
}

/** Compute provider failures (Colab API, Drive API, local provider). */
export class ProviderError extends OrchestratorError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, 'provider_error', context);
    this.name = 'ProviderError';
  }
}

/** Ollama install, start, or model pull failures. */
export class OllamaError extends OrchestratorError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, 'ollama_error', context);
    this.name = 'OllamaError';
  }
}

/** DynamoDB read/write failures. */
export class StateStoreError extends OrchestratorError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, 'state_store_error', context);
    this.name = 'StateStoreError';
  }
}

/** Configuration validation failures. */
export class ConfigError extends OrchestratorError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, 'config_error', context);
    this.name = 'ConfigError';
  }
}
