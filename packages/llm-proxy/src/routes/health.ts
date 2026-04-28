/**
 * Health check route for worker status
 * GET /health
 * Validates: Requirements 5.4
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { formatErrorResponse } from '../schemas/error.js';
import { getLatestSession, isWorkerHealthy } from '../lib/state-store.js';

/**
 * Create a new Hono router for health endpoint
 */
export const createHealthRouter = () => {
  const router = new Hono();

  /**
   * GET /health
   * Returns worker status including session info, heartbeat freshness, and available models
   * Validates: Requirement 5.4
   */
  router.get('/health', async (c) => {
    const requestId = uuidv4();

    try {
      console.log('[HEALTH] GET /health request received', {
        requestId,
        timestamp: new Date().toISOString(),
      });

      // Retrieve the latest session
      const session = await getLatestSession();

      // Check if worker is healthy
      const healthy = await isWorkerHealthy();

      if (!session) {
        console.warn('[HEALTH] No active session found', { requestId });

        const response = {
          status: 'offline',
          message: 'No active worker session',
          sessionId: null,
          heartbeatAge: null,
          availableModels: [],
          timestamp: new Date().toISOString(),
        };

        return c.json(response, 503);
      }

      // Calculate heartbeat age in seconds
      const lastHeartbeatTime = new Date(session.lastHeartbeatAt).getTime();
      const nowTime = Date.now();
      const heartbeatAgeSeconds = (nowTime - lastHeartbeatTime) / 1000;

      const response = {
        status: healthy ? 'healthy' : 'unhealthy',
        message: healthy
          ? 'Worker is active and processing requests'
          : 'Worker heartbeat is stale',
        sessionId: session.sessionId,
        startedAt: session.startedAt,
        lastHeartbeatAt: session.lastHeartbeatAt,
        heartbeatAge: Math.round(heartbeatAgeSeconds),
        heartbeatAgeSeconds: heartbeatAgeSeconds,
        availableModels: session.ollamaModels,
        modelCount: session.ollamaModels.length,
        timestamp: new Date().toISOString(),
      };

      console.log('[HEALTH] Returning health status', {
        requestId,
        status: response.status,
        heartbeatAge: response.heartbeatAge,
        modelCount: response.modelCount,
        timestamp: new Date().toISOString(),
      });

      return c.json(response, healthy ? 200 : 503);
    } catch (error) {
      console.error('[HEALTH] Unexpected error in health handler', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      const errorResponse = formatErrorResponse(
        'internal_error',
        'An unexpected error occurred while checking health status',
        'INTERNAL_ERROR',
        requestId,
      );

      return c.json(errorResponse, 500);
    }
  });

  return router;
};

/**
 * Export the router factory function for use in the main Hono app
 */
export default createHealthRouter;
