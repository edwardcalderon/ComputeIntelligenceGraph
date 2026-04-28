/**
 * Admin routes for session management
 * GET /admin/sessions - list all sessions
 * GET /admin/sessions/:sessionId - get specific session status
 * Validates: Requirements 5.4
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { formatErrorResponse } from '../schemas/error.js';
import { getLatestSession } from '../lib/state-store.js';

/**
 * Create a new Hono router for admin endpoints
 */
export const createAdminRouter = () => {
  const router = new Hono();

  /**
   * GET /admin/sessions
   * Lists all active sessions (currently returns the latest session)
   * Validates: Requirement 5.4
   */
  router.get('/sessions', async (c) => {
    const requestId = uuidv4();

    try {
      console.log('[ADMIN] GET /admin/sessions request received', {
        requestId,
        timestamp: new Date().toISOString(),
      });

      // Retrieve the latest session
      const session = await getLatestSession();

      if (!session) {
        console.log('[ADMIN] No active sessions found', { requestId });

        const response = {
          object: 'list',
          data: [],
          count: 0,
        };

        return c.json(response, 200);
      }

      // Calculate heartbeat age in seconds
      const lastHeartbeatTime = new Date(session.lastHeartbeatAt).getTime();
      const nowTime = Date.now();
      const heartbeatAgeSeconds = (nowTime - lastHeartbeatTime) / 1000;

      const sessionData = {
        sessionId: session.sessionId,
        status: session.status,
        startedAt: session.startedAt,
        lastHeartbeatAt: session.lastHeartbeatAt,
        heartbeatAge: Math.round(heartbeatAgeSeconds),
        modelCount: session.ollamaModels.length,
        models: session.ollamaModels,
      };

      const response = {
        object: 'list',
        data: [sessionData],
        count: 1,
      };

      console.log('[ADMIN] Returning sessions list', {
        requestId,
        sessionCount: 1,
        timestamp: new Date().toISOString(),
      });

      return c.json(response, 200);
    } catch (error) {
      console.error('[ADMIN] Unexpected error in sessions list handler', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      const errorResponse = formatErrorResponse(
        'internal_error',
        'An unexpected error occurred while listing sessions',
        'INTERNAL_ERROR',
        requestId,
      );

      return c.json(errorResponse, 500);
    }
  });

  /**
   * GET /admin/sessions/:sessionId
   * Returns status of a specific session
   * Validates: Requirement 5.4
   */
  router.get('/sessions/:sessionId', async (c) => {
    const requestId = uuidv4();
    const sessionId = c.req.param('sessionId');

    try {
      console.log('[ADMIN] GET /admin/sessions/:sessionId request received', {
        requestId,
        sessionId,
        timestamp: new Date().toISOString(),
      });

      // Retrieve the latest session
      const session = await getLatestSession();

      if (!session || session.sessionId !== sessionId) {
        console.warn('[ADMIN] Session not found', {
          requestId,
          requestedSessionId: sessionId,
        });

        const errorResponse = formatErrorResponse(
          'session_not_found',
          `Session ${sessionId} not found`,
          'SESSION_NOT_FOUND',
          requestId,
        );

        return c.json(errorResponse, 404);
      }

      // Calculate heartbeat age in seconds
      const lastHeartbeatTime = new Date(session.lastHeartbeatAt).getTime();
      const nowTime = Date.now();
      const heartbeatAgeSeconds = (nowTime - lastHeartbeatTime) / 1000;

      const response = {
        sessionId: session.sessionId,
        status: session.status,
        startedAt: session.startedAt,
        lastHeartbeatAt: session.lastHeartbeatAt,
        heartbeatAge: Math.round(heartbeatAgeSeconds),
        heartbeatAgeSeconds: heartbeatAgeSeconds,
        modelCount: session.ollamaModels.length,
        models: session.ollamaModels,
        recordType: session.recordType,
      };

      console.log('[ADMIN] Returning session status', {
        requestId,
        sessionId,
        status: response.status,
        timestamp: new Date().toISOString(),
      });

      return c.json(response, 200);
    } catch (error) {
      console.error('[ADMIN] Unexpected error in session status handler', {
        requestId,
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      const errorResponse = formatErrorResponse(
        'internal_error',
        'An unexpected error occurred while retrieving session status',
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
export default createAdminRouter;
