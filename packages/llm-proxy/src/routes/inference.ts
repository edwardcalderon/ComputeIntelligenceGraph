/**
 * Inference routes for OpenAI-compatible API endpoints
 * POST /v1/completions and POST /v1/chat/completions
 * Validates: Requirements 1.1, 2.2, 2.3, 2.4, 3.3, 3.4, 5.1, 5.2, 5.5, 8.3, 9.1, 9.2, 9.3
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { v4 as uuidv4 } from 'uuid';
import {
  ChatCompletionRequestSchema,
  CompletionRequestSchema,
} from '../schemas/inference.js';
import { formatErrorResponse } from '../schemas/error.js';
import {
  generateCorrelationId,
  buildRequestMessage,
  extractCorrelationId,
} from '../lib/correlation.js';
import {
  sendMessage,
  pollForCorrelatedResponse,
  deleteMessage,
} from '../lib/sqs-client.js';
import { isWorkerHealthy, getLatestSession } from '../lib/state-store.js';
import { OpenAICompletionResponse } from '../types.js';

/**
 * Create a new Hono router for inference endpoints
 */
export const createInferenceRouter = () => {
  const router = new Hono();

  /**
   * POST /v1/chat/completions
   * Chat completion endpoint - accepts OpenAI-compatible chat request
   * Validates: Requirements 1.1, 2.2, 2.3, 2.4, 3.3, 3.4, 5.1, 5.2, 5.5, 8.3, 9.1, 9.2, 9.3
   */
  router.post(
    '/chat/completions',
    zValidator('json', ChatCompletionRequestSchema),
    async (c) => {
      const requestId = uuidv4();
      const startTime = Date.now();

      try {
        const validatedRequest = c.req.valid('json');

        // Log incoming request
        console.log('[INFERENCE] Chat completion request received', {
          requestId,
          model: validatedRequest.model,
          messageCount: validatedRequest.messages?.length,
          timestamp: new Date().toISOString(),
        });

        // Step 1: Check worker health via state-store
        const isHealthy = await isWorkerHealthy();
        if (!isHealthy) {
          console.warn('[INFERENCE] Worker is offline or heartbeat is stale', {
            requestId,
          });

          const errorResponse = formatErrorResponse(
            'worker_offline',
            'No active worker available to process requests',
            'WORKER_OFFLINE',
            requestId,
          );

          return c.json(
            {
              ...errorResponse,
              retryAfter: 30, // Suggest retry after 30 seconds
            },
            503
          );
        }

        // Step 2: Generate Correlation_ID
        const correlationId = generateCorrelationId();
        console.log('[INFERENCE] Generated Correlation_ID', {
          requestId,
          correlationId,
        });

        // Step 3: Build request message and enqueue to Request_Queue
        const requestQueueUrl =
          process.env.REQUEST_QUEUE_URL || 'http://localhost:9324/000000000000/llm-proxy-request-queue';

        const inferenceRequest = {
          correlationId,
          model: validatedRequest.model,
          messages: validatedRequest.messages,
          temperature: validatedRequest.temperature,
          max_tokens: validatedRequest.max_tokens,
          stream: validatedRequest.stream,
          timestamp: Date.now(),
        };

        const requestMessage = buildRequestMessage(
          correlationId,
          inferenceRequest
        );

        let messageId: string;
        try {
          messageId = await sendMessage(
            requestQueueUrl,
            requestMessage.body,
            requestMessage.messageAttributes
          );
          console.log('[INFERENCE] Request enqueued to Request_Queue', {
            requestId,
            correlationId,
            messageId,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error('[INFERENCE] Failed to enqueue request to Request_Queue', {
            requestId,
            correlationId,
            error: error instanceof Error ? error.message : String(error),
          });

          const errorResponse = formatErrorResponse(
            'queue_unavailable',
            'Failed to enqueue request to processing queue',
            'ENQUEUE_FAILED',
            requestId,
          );

          return c.json(errorResponse, 502);
        }

        // Step 4: Poll Response_Queue for correlated response (up to 90s)
        const responseQueueUrl =
          process.env.RESPONSE_QUEUE_URL || 'http://localhost:9324/000000000000/llm-proxy-response-queue';

        console.log('[INFERENCE] Polling Response_Queue for correlated response', {
          requestId,
          correlationId,
          timeoutMs: 90000,
        });

        const responseMessage = await pollForCorrelatedResponse(
          responseQueueUrl,
          correlationId,
          90000 // 90 seconds timeout
        );

        if (!responseMessage) {
          console.error('[INFERENCE] Response timeout - no matching response received', {
            requestId,
            correlationId,
            elapsedMs: Date.now() - startTime,
          });

          const errorResponse = formatErrorResponse(
            'inference_timeout',
            'Inference request timed out after 90 seconds',
            'INFERENCE_TIMEOUT',
            requestId,
          );

          return c.json(errorResponse, 504);
        }

        // Step 5: Extract and parse response
        let responseBody: unknown;
        try {
          responseBody = JSON.parse(responseMessage.Body || '{}');
        } catch (error) {
          console.error('[INFERENCE] Failed to parse response message body', {
            requestId,
            correlationId,
            error: error instanceof Error ? error.message : String(error),
          });

          const errorResponse = formatErrorResponse(
            'invalid_response',
            'Received invalid response from worker',
            'INVALID_RESPONSE',
            requestId,
          );

          return c.json(errorResponse, 500);
        }

        // Step 6: Check response status
        const responseStatus =
          responseMessage.MessageAttributes?.status?.StringValue;
        if (responseStatus === 'error') {
          console.warn('[INFERENCE] Worker returned error response', {
            requestId,
            correlationId,
            responseBody,
          });

          // Delete the error message from the queue
          if (responseMessage.ReceiptHandle) {
            try {
              await deleteMessage(responseQueueUrl, responseMessage.ReceiptHandle);
            } catch (error) {
              console.error('[INFERENCE] Failed to delete error response message', {
                requestId,
                correlationId,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          // Return the error response from the worker
          return c.json(responseBody as Record<string, unknown>, 500);
        }

        // Step 7: Delete the response message from the queue
        if (responseMessage.ReceiptHandle) {
          try {
            await deleteMessage(responseQueueUrl, responseMessage.ReceiptHandle);
            console.log('[INFERENCE] Response message deleted from Response_Queue', {
              requestId,
              correlationId,
            });
          } catch (error) {
            console.error('[INFERENCE] Failed to delete response message', {
              requestId,
              correlationId,
              error: error instanceof Error ? error.message : String(error),
            });
            // Continue anyway - message will become visible again after visibility timeout
          }
        }

        // Step 8: Log dequeue event with latency
        const processingTimeMs = Date.now() - startTime;
        console.log('[INFERENCE] Response dequeued and returned to client', {
          requestId,
          correlationId,
          processingTimeMs,
          timestamp: new Date().toISOString(),
        });

        // Step 9: Return OpenAI-compatible response
        return c.json(responseBody as Record<string, unknown>, 200);
      } catch (error) {
        console.error('[INFERENCE] Unexpected error in chat completion handler', {
          requestId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        const errorResponse = formatErrorResponse(
          'internal_error',
          'An unexpected error occurred while processing your request',
          'INTERNAL_ERROR',
          requestId,
        );

        return c.json(errorResponse, 500);
      }
    }
  );

  /**
   * POST /v1/completions
   * Text completion endpoint - accepts OpenAI-compatible completion request
   * Validates: Requirements 1.1, 2.2, 2.3, 2.4, 3.3, 3.4, 5.1, 5.2, 5.5, 8.3, 9.1, 9.2, 9.3
   */
  router.post(
    '/completions',
    zValidator('json', CompletionRequestSchema),
    async (c) => {
      const requestId = uuidv4();
      const startTime = Date.now();

      try {
        const validatedRequest = c.req.valid('json');

        // Log incoming request
        console.log('[INFERENCE] Text completion request received', {
          requestId,
          model: validatedRequest.model,
          promptLength: validatedRequest.prompt?.length,
          timestamp: new Date().toISOString(),
        });

        // Step 1: Check worker health via state-store
        const isHealthy = await isWorkerHealthy();
        if (!isHealthy) {
          console.warn('[INFERENCE] Worker is offline or heartbeat is stale', {
            requestId,
          });

          const errorResponse = formatErrorResponse(
            'worker_offline',
            'No active worker available to process requests',
            'WORKER_OFFLINE',
            requestId,
          );

          return c.json(
            {
              ...errorResponse,
              retryAfter: 30, // Suggest retry after 30 seconds
            },
            503
          );
        }

        // Step 2: Generate Correlation_ID
        const correlationId = generateCorrelationId();
        console.log('[INFERENCE] Generated Correlation_ID', {
          requestId,
          correlationId,
        });

        // Step 3: Build request message and enqueue to Request_Queue
        const requestQueueUrl =
          process.env.REQUEST_QUEUE_URL || 'http://localhost:9324/000000000000/llm-proxy-request-queue';

        const inferenceRequest = {
          correlationId,
          model: validatedRequest.model,
          prompt: validatedRequest.prompt,
          temperature: validatedRequest.temperature,
          max_tokens: validatedRequest.max_tokens,
          stream: validatedRequest.stream,
          timestamp: Date.now(),
        };

        const requestMessage = buildRequestMessage(
          correlationId,
          inferenceRequest
        );

        let messageId: string;
        try {
          messageId = await sendMessage(
            requestQueueUrl,
            requestMessage.body,
            requestMessage.messageAttributes
          );
          console.log('[INFERENCE] Request enqueued to Request_Queue', {
            requestId,
            correlationId,
            messageId,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error('[INFERENCE] Failed to enqueue request to Request_Queue', {
            requestId,
            correlationId,
            error: error instanceof Error ? error.message : String(error),
          });

          const errorResponse = formatErrorResponse(
            'queue_unavailable',
            'Failed to enqueue request to processing queue',
            'ENQUEUE_FAILED',
            requestId,
          );

          return c.json(errorResponse, 502);
        }

        // Step 4: Poll Response_Queue for correlated response (up to 90s)
        const responseQueueUrl =
          process.env.RESPONSE_QUEUE_URL || 'http://localhost:9324/000000000000/llm-proxy-response-queue';

        console.log('[INFERENCE] Polling Response_Queue for correlated response', {
          requestId,
          correlationId,
          timeoutMs: 90000,
        });

        const responseMessage = await pollForCorrelatedResponse(
          responseQueueUrl,
          correlationId,
          90000 // 90 seconds timeout
        );

        if (!responseMessage) {
          console.error('[INFERENCE] Response timeout - no matching response received', {
            requestId,
            correlationId,
            elapsedMs: Date.now() - startTime,
          });

          const errorResponse = formatErrorResponse(
            'inference_timeout',
            'Inference request timed out after 90 seconds',
            'INFERENCE_TIMEOUT',
            requestId,
          );

          return c.json(errorResponse, 504);
        }

        // Step 5: Extract and parse response
        let responseBody: unknown;
        try {
          responseBody = JSON.parse(responseMessage.Body || '{}');
        } catch (error) {
          console.error('[INFERENCE] Failed to parse response message body', {
            requestId,
            correlationId,
            error: error instanceof Error ? error.message : String(error),
          });

          const errorResponse = formatErrorResponse(
            'invalid_response',
            'Received invalid response from worker',
            'INVALID_RESPONSE',
            requestId,
          );

          return c.json(errorResponse, 500);
        }

        // Step 6: Check response status
        const responseStatus =
          responseMessage.MessageAttributes?.status?.StringValue;
        if (responseStatus === 'error') {
          console.warn('[INFERENCE] Worker returned error response', {
            requestId,
            correlationId,
            responseBody,
          });

          // Delete the error message from the queue
          if (responseMessage.ReceiptHandle) {
            try {
              await deleteMessage(responseQueueUrl, responseMessage.ReceiptHandle);
            } catch (error) {
              console.error('[INFERENCE] Failed to delete error response message', {
                requestId,
                correlationId,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          // Return the error response from the worker
          return c.json(responseBody as Record<string, unknown>, 500);
        }

        // Step 7: Delete the response message from the queue
        if (responseMessage.ReceiptHandle) {
          try {
            await deleteMessage(responseQueueUrl, responseMessage.ReceiptHandle);
            console.log('[INFERENCE] Response message deleted from Response_Queue', {
              requestId,
              correlationId,
            });
          } catch (error) {
            console.error('[INFERENCE] Failed to delete response message', {
              requestId,
              correlationId,
              error: error instanceof Error ? error.message : String(error),
            });
            // Continue anyway - message will become visible again after visibility timeout
          }
        }

        // Step 8: Log dequeue event with latency
        const processingTimeMs = Date.now() - startTime;
        console.log('[INFERENCE] Response dequeued and returned to client', {
          requestId,
          correlationId,
          processingTimeMs,
          timestamp: new Date().toISOString(),
        });

        // Step 9: Return OpenAI-compatible response
        return c.json(responseBody as Record<string, unknown>, 200);
      } catch (error) {
        console.error('[INFERENCE] Unexpected error in text completion handler', {
          requestId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        const errorResponse = formatErrorResponse(
          'internal_error',
          'An unexpected error occurred while processing your request',
          'INTERNAL_ERROR',
          requestId,
        );

        return c.json(errorResponse, 500);
      }
    }
  );

  return router;
};

/**
 * Export the router factory function for use in the main Hono app
 */
export default createInferenceRouter;
