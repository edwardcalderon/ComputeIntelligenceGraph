/**
 * Models route for OpenAI-compatible model listing
 * GET /v1/models
 * Validates: Requirements 5.3
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { formatErrorResponse } from '../schemas/error.js';
import { getLatestSession } from '../lib/state-store.js';

/**
 * Create a new Hono router for models endpoint
 */
export const createModelsRouter = () => {
  const router = new Hono();

  /**
   * GET /v1/models
   * Returns available models from the latest worker session
   * Validates: Requirement 5.3
   */
  router.get('/models', async (c) => {
    const requestId = uuidv4();

    try {
      console.log('[MODELS] GET /v1/models request received', {
        requestId,
        timestamp: new Date().toISOString(),
      });

      // Retrieve the latest session to get available models
      const session = await getLatestSession();

      if (!session) {
        console.warn('[MODELS] No active session found', { requestId });

        const errorResponse = formatErrorResponse(
          'no_session',
          'No active worker session available',
          'NO_SESSION',
          requestId,
        );

        return c.json(errorResponse, 503);
      }

      // Build OpenAI-compatible model list response
      const models = session.ollamaModels.map((modelName: string) => ({
        id: modelName,
        object: 'model',
        created: Math.floor(new Date(session.startedAt).getTime() / 1000),
        owned_by: 'ollama',
        permission: [
          {
            id: `modelperm-${uuidv4()}`,
            object: 'model_permission',
            created: Math.floor(new Date(session.startedAt).getTime() / 1000),
            allow_create_engine: false,
            allow_sampling: true,
            allow_logprobs: false,
            allow_search_indices: false,
            allow_view: true,
            allow_fine_tuning: false,
            organization: '*',
            group_id: null,
            is_blocking: false,
          },
        ],
      }));

      const response = {
        object: 'list',
        data: models,
      };

      console.log('[MODELS] Returning model list', {
        requestId,
        modelCount: models.length,
        timestamp: new Date().toISOString(),
      });

      return c.json(response, 200);
    } catch (error) {
      console.error('[MODELS] Unexpected error in models handler', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      const errorResponse = formatErrorResponse(
        'internal_error',
        'An unexpected error occurred while retrieving models',
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
export default createModelsRouter;
