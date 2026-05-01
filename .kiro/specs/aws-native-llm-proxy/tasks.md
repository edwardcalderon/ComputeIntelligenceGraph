# Implementation Plan: AWS-Native LLM Proxy

## Overview

Incremental implementation of a fully standalone `packages/llm-proxy/` package that replaces Cloudflare Tunnel connectivity with an AWS-native SQS-based request/response pattern. The Proxy_Lambda (Hono/TypeScript) enqueues inference requests, the Colab_Worker (Python/boto3) polls and processes them via Ollama, and responses are matched by Correlation_ID. DynamoDB provides state management for worker lifecycle. Zero coupling to the existing CIG API.

## Tasks

- [x] 1. Scaffold package structure and core configuration
  - [x] 1.1 Initialize `packages/llm-proxy/` with `package.json` (`@llm-proxy/app`), `tsconfig.json`, `vitest.config.ts`, and `sst-env.d.ts`
    - Zero `@cig/*` dependencies — add hono, zod, @hono/zod-validator, @aws-sdk/client-sqs, @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb, uuid as dependencies
    - Add fast-check, vitest, @types/node, typescript, sst, @pulumi/aws, @pulumi/pulumi as devDependencies
    - Configure vitest with test file patterns for `src/__tests__/**/*.test.ts`
    - _Requirements: 6.7_

  - [x] 1.2 Create `packages/llm-proxy/sst.config.ts` with app name `llm-proxy` and basic SST structure
    - Mirror the pattern from `packages/infra/sst.config.ts` but with app name `llm-proxy`
    - Configure AWS provider with region from environment
    - Import infrastructure definitions from `./infra/index.ts`
    - _Requirements: 6.7_

- [ ] 2. Define TypeScript types, Zod schemas, and error schema
  - [x] 2.1 Create `src/types.ts` with `InferenceRequest`, `InferenceResponse`, `WorkerSession`, `ChatMessage`, and `OpenAICompletionResponse` interfaces
    - Include all fields from the design: correlationId, model, messages, prompt, temperature, max_tokens, stream, timestamp, status, body, error, processingTimeMs
    - Include WorkerSession with sessionId, recordType, startedAt, lastHeartbeatAt, status, ollamaModels, ttl
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 2.2 Create `src/schemas/inference.ts` with Zod schemas: `ChatMessageSchema`, `ChatCompletionRequestSchema`, `CompletionRequestSchema`
    - ChatMessageSchema: role enum (system, user, assistant), non-empty content string
    - ChatCompletionRequestSchema: non-empty model, non-empty messages array, temperature [0,2] default 0.7, positive int max_tokens default 512, stream literal false default false
    - CompletionRequestSchema: non-empty model, non-empty prompt, same temperature/max_tokens/stream constraints
    - _Requirements: 5.1, 5.2_

  - [x] 2.3 Create `src/schemas/error.ts` with `ErrorResponseSchema` Zod schema
    - Fields: error (non-empty string), message (non-empty string), code (non-empty string), requestId (string)
    - Export a `formatErrorResponse` helper function that builds a conformant error object
    - _Requirements: 9.4_

  - [ ]* 2.4 Write property tests for request schema validation
    - **Property 3: Request Schema Validation**
    - Generate arbitrary JSON objects with fast-check; verify ChatCompletionRequestSchema and CompletionRequestSchema accept valid inputs and reject invalid ones
    - Test file: `src/__tests__/schemas.property.test.ts`
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 2.5 Write property tests for error response schema consistency
    - **Property 5: Error Response Schema Consistency**
    - Generate arbitrary error conditions; verify formatErrorResponse always produces objects with all four required fields (error, message, code, requestId)
    - Test file: `src/__tests__/error-handling.property.test.ts`
    - **Validates: Requirements 9.1, 9.4**

- [ ] 3. Implement core library modules
  - [x] 3.1 Create `src/lib/correlation.ts` — Correlation_ID generation and response matching
    - `generateCorrelationId()`: returns UUIDv4 string
    - `buildRequestMessage(correlationId, payload)`: builds SQS message body + MessageAttributes for Request_Queue
    - `buildResponseMessage(correlationId, response, status, processingTimeMs)`: builds SQS message for Response_Queue
    - `extractCorrelationId(message)`: extracts correlation_id from SQS message attributes
    - _Requirements: 1.1, 2.1, 2.6_

  - [ ]* 3.2 Write property tests for Correlation_ID round-trip preservation
    - **Property 1: Correlation_ID Round-Trip Preservation**
    - For arbitrary payloads, verify buildRequestMessage then buildResponseMessage preserves the same Correlation_ID
    - **Property 6: Error Path Correlation_ID Preservation**
    - For arbitrary Correlation_IDs and error conditions, verify error response messages preserve the Correlation_ID and set status to "error"
    - Test file: `src/__tests__/correlation.property.test.ts`
    - **Validates: Requirements 1.1, 2.1, 2.6, 7.5**

  - [x] 3.3 Create `src/lib/sqs-client.ts` — SQS send/receive wrappers with retry logic
    - `sendMessage(queueUrl, body, attributes)`: sends SQS message with exponential backoff retry (base=500ms, multiplier=3, max_retries=2)
    - `receiveMessages(queueUrl, options)`: receives messages with configurable wait time and attribute filtering
    - `deleteMessage(queueUrl, receiptHandle)`: deletes processed message
    - `pollForCorrelatedResponse(queueUrl, correlationId, timeoutMs)`: polls Response_Queue filtering by Correlation_ID up to 90s
    - _Requirements: 1.1, 2.2, 9.3_

  - [ ]* 3.4 Write property test for retry exhaustion behavior
    - **Property 8: Retry Exhaustion Behavior**
    - For sequences of N failures (0 ≤ N ≤ 3), verify the retry-enabled send attempts exactly min(N, 3) calls, returns success if any attempt succeeds, returns error only after all 3 fail
    - Test file: `src/__tests__/error-handling.property.test.ts`
    - **Validates: Requirements 9.3**

  - [x] 3.5 Create `src/lib/state-store.ts` — DynamoDB read/write for sessions and heartbeats
    - `getLatestSession()`: reads PK=`SESSION#LATEST`, SK=`META` to get current worker session
    - `isWorkerHealthy()`: checks if lastHeartbeatAt is within 120 seconds of now
    - `registerSession(sessionId, models, startedAt)`: writes session record with conditional check, updates LATEST pointer
    - `updateHeartbeat(sessionId)`: updates lastHeartbeatAt and ttl
    - `terminateSession(sessionId)`: sets status to terminated
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 4.2, 4.3, 4.5_

  - [ ]* 3.6 Write property tests for state store logic
    - **Property 4: Session Registration Invariant**
    - For arbitrary session IDs, model lists, and timestamps, verify the DynamoDB item contains non-empty sessionId, valid ISO 8601 startedAt, lastHeartbeatAt equal to startedAt, status active, and ttl exactly 86400s after start
    - **Property 7: Heartbeat Freshness Classification**
    - For arbitrary timestamp pairs, verify isWorkerHealthy returns true iff difference ≤ 120 seconds
    - Test file: `src/__tests__/state-store.property.test.ts`
    - **Validates: Requirements 3.1, 3.3**

- [x] 4. Checkpoint — Ensure all core library tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement Hono routes and middleware
  - [x] 5.1 Create `src/lib/auth.ts` — API key authentication middleware for Hono
    - Validate API key from Authorization header or x-api-key header
    - Return 401 with consistent error schema on failure
    - _Requirements: 5.6_

  - [x] 5.2 Create `src/lib/rate-limit.ts` — Rate limiting middleware for Hono
    - In-memory rate limiter (suitable for single Lambda instance)
    - Return 429 with retryAfter header on limit exceeded
    - _Requirements: 5.6_

  - [x] 5.3 Create `src/routes/inference.ts` — POST /v1/completions and POST /v1/chat/completions
    - Validate request body with Zod schemas
    - Check worker health via state-store (return 503 if stale heartbeat with retryAfter field)
    - Generate Correlation_ID, enqueue to Request_Queue via sqs-client (return 502 on queue failure)
    - Poll Response_Queue for correlated response up to 90s (return 504 on timeout)
    - Format and return OpenAI-compatible JSON response
    - Log enqueue/dequeue events with Correlation_ID, timestamps, and latency to CloudWatch
    - _Requirements: 1.1, 2.2, 2.3, 2.4, 3.3, 3.4, 5.1, 5.2, 5.5, 8.3, 9.1, 9.2, 9.3_

  - [ ]* 5.4 Write property test for response schema conformance
    - **Property 2: Response Schema Conformance**
    - For arbitrary valid inference results (model name, token counts, completion text), verify the response formatting function produces JSON with all required OpenAI fields: id, object, created, model, choices (non-empty), usage (prompt_tokens, completion_tokens, total_tokens)
    - Test file: `src/__tests__/schemas.property.test.ts`
    - **Validates: Requirements 2.4, 5.5**

  - [x] 5.5 Create `src/routes/models.ts` — GET /v1/models
    - Read available models from State_Store (latest session's ollamaModels)
    - Return OpenAI-compatible model list response
    - _Requirements: 5.3_

  - [x] 5.6 Create `src/routes/health.ts` — GET /health
    - Return worker status from State_Store (session info, heartbeat freshness)
    - _Requirements: 5.4_

  - [x] 5.7 Create `src/routes/admin.ts` — Admin endpoints for session management
    - Expose session listing and status endpoints
    - _Requirements: 5.4_

  - [x] 5.8 Create `src/routes/mcp.ts` — MCP tool endpoints
    - Expose MCP_Endpoint routes with appropriate path structure
    - _Requirements: 5.4_

  - [x] 5.9 Create `src/index.ts` — Hono app entry point and Lambda handler
    - Initialize Hono app, register all route groups (/v1/*, /health, /admin/*, /mcp/*)
    - Apply auth and rate-limit middleware to inference endpoints
    - Export Lambda handler using @hono/aws-lambda adapter
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [ ]* 5.10 Write unit tests for inference routes
    - Test HTTP 504 on response timeout (Req 2.3)
    - Test HTTP 503 on stale heartbeat with retryAfter field (Req 3.4, 9.2)
    - Test HTTP 502 on queue unreachable (Req 9.1)
    - Test standard queue usage — no MessageGroupId (Req 1.6)
    - Test file: `src/__tests__/inference.test.ts`
    - **Validates: Requirements 1.6, 2.3, 3.4, 9.1, 9.2**

  - [ ]* 5.11 Write unit tests for health and models routes
    - Test GET /v1/models response format (Req 5.3)
    - Test route registration for health, admin, MCP endpoints (Req 5.4)
    - Test file: `src/__tests__/health.test.ts`
    - **Validates: Requirements 5.3, 5.4**

- [x] 6. Checkpoint — Ensure all route and middleware tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Define SST infrastructure
  - [x] 7.1 Create `packages/llm-proxy/infra/index.ts` — SQS queues, DynamoDB table, Lambda, API Gateway, IAM, SNS, CloudWatch
    - Define `llm-proxy-request-queue` (SQS Standard, VisibilityTimeout=120s, MessageRetention=300s, encryption at rest with AWS-managed KMS)
    - Define `llm-proxy-response-queue` (SQS Standard, VisibilityTimeout=30s, MessageRetention=300s, encryption at rest)
    - Define `llm-proxy-dlq` (SQS Standard, MessageRetention=14 days, encryption at rest, RedrivePolicy maxReceiveCount=3 on request queue)
    - Define `llm-proxy-state` DynamoDB table (PK=string, SK=string, TTL enabled, on-demand billing mode)
    - Define `llm-proxy-lambda` (256MB, 90s timeout, Hono handler from src/index.ts)
    - Define `llm-proxy-api` API Gateway HTTP API with routes: /v1/*, /health, /admin/*, /mcp/*
    - Define IAM role for Proxy_Lambda: sqs:SendMessage on Request_Queue, sqs:ReceiveMessage + sqs:DeleteMessage on Response_Queue, DynamoDB read on state table
    - Define `llm-proxy-worker-user` IAM user with least-privilege: sqs:ReceiveMessage + sqs:DeleteMessage on Request_Queue, sqs:SendMessage on Response_Queue, DynamoDB read/write on state table
    - Define `llm-proxy-alerts` SNS topic for email notifications
    - Define CloudWatch alarm: Request_Queue depth > 10 for 5 minutes → SNS alert
    - Define CloudWatch alarm: DLQ ApproximateNumberOfMessagesVisible > 0 → SNS alert
    - Define CloudWatch alarm: custom metric for heartbeat age > 120s → SNS alert
    - All resource names prefixed with `llm-proxy-` to avoid conflicts
    - Total CloudWatch alarms ≤ 10 (within free tier)
    - _Requirements: 1.4, 1.5, 2.5, 4.1, 4.4, 4.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.6, 8.1, 8.2, 8.4, 8.5, 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 8. Implement Colab Worker (Python)
  - [x] 8.1 Create `packages/llm-proxy/colab/requirements.txt` with boto3 and requests dependencies
    - _Requirements: 7.2_

  - [x] 8.2 Create `packages/llm-proxy/colab/worker.py` — ColabWorker class
    - `__init__(aws_config)`: initialize SQS clients (request queue, response queue) and DynamoDB resource using IAM credentials from config
    - `register_session()`: write session record to State_Store with unique session ID, start timestamp, initial heartbeat, status=active, TTL=24h; update LATEST pointer with conditional write
    - `heartbeat_loop()`: background thread updating heartbeat timestamp in State_Store every 60 seconds
    - `poll_and_process()`: main loop — long-poll Request_Queue (WaitTimeSeconds=20), delete message after receipt, forward to Ollama, enqueue response
    - `forward_to_ollama(request)`: POST to localhost:11434/api/generate or /api/chat based on request type
    - `enqueue_response(correlation_id, response)`: place response on Response_Queue with matching Correlation_ID and status attribute
    - `handle_ollama_error(correlation_id, error)`: enqueue error response with matching Correlation_ID, status=error, appropriate error code; continue polling
    - `shutdown()`: mark session as terminated in State_Store
    - On unrecoverable Ollama errors, continue processing subsequent requests without terminating the polling loop
    - _Requirements: 1.2, 1.3, 2.1, 3.1, 3.2, 3.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 9.5_

  - [x] 8.3 Create `packages/llm-proxy/colab/notebook.py` — Colab notebook entry point
    - Install dependencies, configure AWS credentials from Colab secrets
    - Start Ollama server, pull model
    - Instantiate ColabWorker and run poll_and_process with graceful shutdown handling
    - _Requirements: 7.1, 7.2_

- [x] 9. Checkpoint — Ensure all tests pass and review integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 10. Write integration tests
  - [ ]* 10.1 Write integration tests for SQS client with mocked AWS SDK
    - Test long-polling configuration (WaitTimeSeconds=20) (Req 1.2)
    - Test DeleteMessage after receipt (Req 1.3)
    - Test pollForCorrelatedResponse timeout behavior
    - Test file: `src/__tests__/sqs-client.test.ts`
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 10.2 Write integration tests for state store with mocked DynamoDB
    - Test heartbeat interval timing (Req 3.2)
    - Test session termination on shutdown (Req 3.5)
    - Test conditional write for concurrent session registration (Req 4.3)
    - Test file: `src/__tests__/state-store.test.ts`
    - **Validates: Requirements 3.2, 3.5, 4.3**

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the 8 universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- The Colab Worker (Python) is tested manually via notebook execution — automated Python tests are out of scope for this TypeScript-focused test suite
- All infrastructure resources are prefixed with `llm-proxy-` and deployed independently from the CIG API
