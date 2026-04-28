/**
 * API key authentication middleware for Hono
 * Validates: Requirement 5.6
 */

import { Context, MiddlewareHandler } from 'hono';
import { formatErrorResponse } from '../schemas/error.js';

/**
 * Configuration for API key authentication
 */
export interface AuthConfig {
  /** Valid API keys (in production, these would come from environment or a secure store) */
  validApiKeys: Set<string>;
  /** Whether to log authentication attempts (default: true) */
  logAttempts?: boolean;
}

/**
 * Creates an API key authentication middleware for Hono
 * Validates API key from Authorization header (Bearer token) or x-api-key header
 * Returns 401 with consistent error schema on failure
 * Validates: Requirement 5.6
 *
 * @param config - Authentication configuration with valid API keys
 * @returns Hono middleware handler
 *
 * @example
 * const authMiddleware = createAuthMiddleware({
 *   validApiKeys: new Set(['key1', 'key2']),
 *   logAttempts: true,
 * });
 * app.use('/v1/*', authMiddleware);
 */
export function createAuthMiddleware(config: AuthConfig): MiddlewareHandler {
  const { validApiKeys, logAttempts = true } = config;

  return async (c: Context, next) => {
    const apiKey = extractApiKey(c);

    if (!apiKey) {
      if (logAttempts) {
        console.warn('[AUTH] Missing API key in request', {
          path: c.req.path,
          method: c.req.method,
          clientIp: c.req.header('x-forwarded-for') || 'unknown',
        });
      }

      const errorResponse = formatErrorResponse(
        'unauthorized',
        'Missing or invalid API key',
        'MISSING_API_KEY',
      );

      return c.json(errorResponse, 401);
    }

    if (!validApiKeys.has(apiKey)) {
      if (logAttempts) {
        console.warn('[AUTH] Invalid API key in request', {
          path: c.req.path,
          method: c.req.method,
          clientIp: c.req.header('x-forwarded-for') || 'unknown',
          keyPrefix: apiKey.substring(0, 8),
        });
      }

      const errorResponse = formatErrorResponse(
        'unauthorized',
        'Invalid API key',
        'INVALID_API_KEY',
      );

      return c.json(errorResponse, 401);
    }

    // API key is valid, proceed to next middleware/handler
    await next();
  };
}

/**
 * Extracts API key from request headers
 * Checks Authorization header (Bearer token) first, then x-api-key header
 * Validates: Requirement 5.6
 *
 * @param c - Hono context
 * @returns API key string or null if not found
 */
function extractApiKey(c: Context): string | null {
  // Check Authorization header for Bearer token
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      return token;
    }
  }

  // Check x-api-key header
  const apiKeyHeader = c.req.header('x-api-key');
  if (apiKeyHeader) {
    return apiKeyHeader.trim();
  }

  return null;
}

/**
 * Helper function to create a simple in-memory API key store
 * In production, this should be replaced with a secure credential store
 *
 * @param keys - Array of valid API keys
 * @returns AuthConfig object ready for createAuthMiddleware
 */
export function createAuthConfig(keys: string[]): AuthConfig {
  return {
    validApiKeys: new Set(keys),
    logAttempts: true,
  };
}
