/**
 * Rate limiting middleware for Hono
 * Implements in-memory rate limiter suitable for single Lambda instance
 * Validates: Requirement 5.6
 */

import { Context, MiddlewareHandler } from 'hono';
import { formatErrorResponse } from '../schemas/error.js';

/**
 * Configuration for rate limiting
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed per window */
  requestsPerWindow: number;
  /** Duration of the rate limit window in milliseconds */
  windowDurationMs: number;
  /** Whether to use API key for rate limiting (if available) or fall back to client IP */
  useApiKeyIfAvailable?: boolean;
  /** Whether to log rate limit events (default: true) */
  logEvents?: boolean;
}

/**
 * In-memory store for tracking request counts per client
 * Each entry maps a client identifier to an array of request timestamps
 */
interface RateLimitStore {
  [clientId: string]: number[];
}

/**
 * Creates a rate limiting middleware for Hono
 * Tracks requests per client IP or API key and returns 429 when limit is exceeded
 * Validates: Requirement 5.6
 *
 * @param config - Rate limit configuration
 * @returns Hono middleware handler
 *
 * @example
 * const rateLimitMiddleware = createRateLimitMiddleware({
 *   requestsPerWindow: 100,
 *   windowDurationMs: 60000, // 1 minute
 *   useApiKeyIfAvailable: true,
 * });
 * app.use('/v1/*', rateLimitMiddleware);
 */
export function createRateLimitMiddleware(config: RateLimitConfig): MiddlewareHandler {
  const {
    requestsPerWindow,
    windowDurationMs,
    useApiKeyIfAvailable = true,
    logEvents = true,
  } = config;

  const store: RateLimitStore = {};

  return async (c: Context, next) => {
    const clientId = getClientIdentifier(c, useApiKeyIfAvailable);
    const now = Date.now();

    // Initialize or retrieve the request timestamps for this client
    if (!store[clientId]) {
      store[clientId] = [];
    }

    const timestamps = store[clientId];

    // Remove timestamps outside the current window
    const windowStart = now - windowDurationMs;
    const validTimestamps = timestamps.filter((ts) => ts > windowStart);

    // Check if the client has exceeded the rate limit
    if (validTimestamps.length >= requestsPerWindow) {
      if (logEvents) {
        console.warn('[RATE_LIMIT] Rate limit exceeded', {
          clientId,
          path: c.req.path,
          method: c.req.method,
          requestCount: validTimestamps.length,
          limit: requestsPerWindow,
        });
      }

      // Calculate retry-after value: time until the oldest request leaves the window
      const oldestTimestamp = validTimestamps[0];
      const retryAfterMs = oldestTimestamp + windowDurationMs - now;
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

      const errorResponse = formatErrorResponse(
        'rate_limited',
        `Rate limit exceeded: ${requestsPerWindow} requests per ${windowDurationMs / 1000}s`,
        'RATE_LIMITED',
      );

      // Set the Retry-After header (in seconds, as per HTTP spec)
      c.header('Retry-After', String(retryAfterSeconds));

      return c.json(errorResponse, 429);
    }

    // Record this request
    validTimestamps.push(now);
    store[clientId] = validTimestamps;

    if (logEvents && validTimestamps.length === 1) {
      console.debug('[RATE_LIMIT] New client tracked', {
        clientId,
        path: c.req.path,
      });
    }

    // Proceed to next middleware/handler
    await next();
  };
}

/**
 * Extracts the client identifier for rate limiting
 * Uses API key if available and useApiKeyIfAvailable is true, otherwise uses client IP
 * Validates: Requirement 5.6
 *
 * @param c - Hono context
 * @param useApiKeyIfAvailable - Whether to prefer API key over IP
 * @returns Client identifier string
 */
function getClientIdentifier(c: Context, useApiKeyIfAvailable: boolean): string {
  // Try to get API key if enabled
  if (useApiKeyIfAvailable) {
    const apiKey = extractApiKey(c);
    if (apiKey) {
      return `api-key:${apiKey}`;
    }
  }

  // Fall back to client IP
  const clientIp = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'unknown';
  return `ip:${clientIp}`;
}

/**
 * Extracts API key from request headers
 * Checks Authorization header (Bearer token) first, then x-api-key header
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
 * Helper function to create a default rate limit configuration
 * Suitable for typical API usage patterns
 *
 * @param requestsPerWindow - Maximum requests per window (default: 100)
 * @param windowDurationSeconds - Window duration in seconds (default: 60)
 * @returns RateLimitConfig object ready for createRateLimitMiddleware
 */
export function createRateLimitConfig(
  requestsPerWindow: number = 100,
  windowDurationSeconds: number = 60,
): RateLimitConfig {
  return {
    requestsPerWindow,
    windowDurationMs: windowDurationSeconds * 1000,
    useApiKeyIfAvailable: true,
    logEvents: true,
  };
}
