/**
 * Main Hono application entry point for AWS Lambda
 * Registers all routes and middleware
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.6
 */

import { Hono } from 'hono';
import { handle } from 'hono/aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { createInferenceRouter } from './routes/inference.js';
import { createModelsRouter } from './routes/models.js';
import { createHealthRouter } from './routes/health.js';
import { createAdminRouter } from './routes/admin.js';
import { createMCPRouter } from './routes/mcp.js';
import { createAuthMiddleware, createAuthConfig } from './lib/auth.js';
import { createRateLimitMiddleware, createRateLimitConfig } from './lib/rate-limit.js';

/**
 * Initialize the Hono application
 */
const app = new Hono<{ Variables: { requestId: string } }>();

/**
 * Global middleware: Request ID logging
 */
app.use(async (c, next) => {
  const requestId = uuidv4();
  c.set('requestId', requestId);

  console.log('[APP] Incoming request', {
    requestId,
    method: c.req.method,
    path: c.req.path,
    timestamp: new Date().toISOString(),
  });

  await next();

  console.log('[APP] Request completed', {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Health check endpoint (no auth required)
 */
const healthRouter = createHealthRouter();
app.route('', healthRouter);

/**
 * Models endpoint (no auth required)
 */
const modelsRouter = createModelsRouter();
app.route('/v1', modelsRouter);

/**
 * Admin endpoints (no auth required for now, but should be protected in production)
 */
const adminRouter = createAdminRouter();
app.route('/admin', adminRouter);

/**
 * MCP endpoints (no auth required for now, but should be protected in production)
 */
const mcpRouter = createMCPRouter();
app.route('/mcp', mcpRouter);

/**
 * Inference endpoints with authentication and rate limiting
 * These are the main inference endpoints that require protection
 */
const inferenceRouter = createInferenceRouter();

// Apply auth middleware to inference routes
const apiKeys = (process.env.API_KEYS || '').split(',').filter(Boolean);
const authConfig = createAuthConfig(apiKeys);
const authMiddleware = createAuthMiddleware(authConfig);

// Apply rate limit middleware to inference routes
const rateLimitPerMinute = parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60', 10);
const rateLimitConfig = createRateLimitConfig(rateLimitPerMinute, 60);
const rateLimitMiddleware = createRateLimitMiddleware(rateLimitConfig);

// Register inference routes with middleware
app.use('/v1/completions', authMiddleware);
app.use('/v1/completions', rateLimitMiddleware);
app.use('/v1/chat/completions', authMiddleware);
app.use('/v1/chat/completions', rateLimitMiddleware);
app.route('/v1', inferenceRouter);

/**
 * 404 handler
 */
app.notFound((c) => {
  const requestId = c.get('requestId') || uuidv4();

  return c.json(
    {
      error: 'not_found',
      message: `Route ${c.req.method} ${c.req.path} not found`,
      code: 'NOT_FOUND',
      requestId,
    },
    404
  );
});

/**
 * Error handler
 */
app.onError((error, c) => {
  const requestId = c.get('requestId') || uuidv4();

  console.error('[APP] Unhandled error', {
    requestId,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  return c.json(
    {
      error: 'internal_error',
      message: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      requestId,
    },
    500
  );
});

/**
 * Export the Lambda handler using Hono's AWS Lambda adapter
 */
export const handler = handle(app);

/**
 * Export the app for testing
 */
export default app;
