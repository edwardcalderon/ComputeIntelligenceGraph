# Implementation Plan: GPU Orchestrator

## Overview

Build the `packages/gpu-orchestrator/` package — a standalone TypeScript CLI that automates GPU compute session lifecycle for Ollama-based LLM inference. Implementation proceeds bottom-up: shared utilities and types first, then core logic (config, notebook, providers), state management, health monitoring, session orchestration, CLI entry point, and finally integration wiring. Each task is independently testable and builds on the previous steps.

## Tasks

- [x] 1. Scaffold package structure and shared utilities
  - [x] 1.1 Create package.json, tsconfig.json, and vitest.config.ts
    - Create `packages/gpu-orchestrator/package.json` with name `@gpu-orchestrator/app`, type `module`, bin entry pointing to `dist/cli.js`, and scripts for `build`, `dev`, `lint`, `test`, `start`, `clean`
    - Dependencies: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `googleapis` (Drive API), `zod`, `uuid`
    - DevDependencies: `typescript` ^5.4, `vitest` ^1.4, `fast-check` ^3.23, `@types/node` ^20, `@types/uuid` ^9
    - Create `tsconfig.json` targeting ES2022, Node16 module resolution, strict mode, ESM, no external extends
    - Create `vitest.config.ts` with `src/__tests__` include pattern
    - Verify zero `@cig/*` dependencies
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 1.2 Implement typed error classes (`src/lib/errors.ts`)
    - Create base `OrchestratorError` class extending `Error` with `category` field typed as `ErrorCategory`
    - Create subclasses: `AuthError`, `ProviderError`, `OllamaError`, `StateStoreError`, `ConfigError`
    - Each subclass sets its `category` field (`auth_error`, `provider_error`, `ollama_error`, `state_store_error`, `config_error`)
    - Include `context` record for structured error metadata (component, sessionId, operation)
    - _Requirements: 10.2, 10.4_

  - [x] 1.3 Implement structured JSON logger (`src/lib/logger.ts`)
    - Create `Logger` class that outputs JSON lines with fields: `timestamp` (ISO 8601), `level`, `component`, `sessionId`, `message`, and optional `error` details
    - Support log levels: `debug`, `info`, `warn`, `error`, `critical`
    - Accept `component` and `sessionId` at construction time
    - _Requirements: 10.1, 8.6_

  - [x] 1.4 Write property test for structured log entry completeness
    - **Property 11: Structured Log Entry Completeness**
    - For any log parameters (level, component, sessionId, message, optional error), the logger output parsed as JSON must contain all required fields with valid types
    - **Validates: Requirements 10.1**

- [x] 2. Implement configuration loading and validation
  - [x] 2.1 Define Zod schemas and config loader (`src/config/schemas.ts` and `src/config/loader.ts`)
    - Define `ConfigSchema` with all `GPU_ORCH_*` env var mappings as specified in the design
    - Implement `loadConfig()` that reads `GPU_ORCH_*` env vars, strips prefix, validates with Zod, and returns typed `OrchestratorConfig`
    - Implement `redactConfig()` that replaces `googleCredentialsPath`, `googleOAuthClientId`, `googleOAuthClientSecret` values with `'***'`
    - On validation failure, exit with a list of all validation errors (not just the first)
    - _Requirements: 1.7, 9.1, 9.2, 9.3, 9.6_

  - [x] 2.2 Write property test for configuration round-trip
    - **Property 3: Configuration Round-Trip**
    - For any valid `OrchestratorConfig`, serializing to JSON and parsing back via `ConfigSchema.parse()` produces an equivalent object
    - **Validates: Requirements 1.7, 9.1, 12.5**

  - [x] 2.3 Write property test for configuration validation error completeness
    - **Property 4: Configuration Validation Error Completeness**
    - For any config with N distinct validation errors, Zod reports all N errors
    - **Validates: Requirements 9.2**

  - [x] 2.4 Write property test for configuration redaction
    - **Property 5: Configuration Redaction**
    - For any valid config, `redactConfig()` replaces sensitive fields with `'***'` and preserves all other fields
    - **Validates: Requirements 9.6**

- [x] 3. Implement notebook generation
  - [x] 3.1 Define notebook types and generator (`src/notebook/types.ts` and `src/notebook/generator.ts`)
    - Define `NotebookDocument`, `NotebookCell`, and `NotebookParams` interfaces per the design
    - Implement `generateNotebook(params)` that builds a valid nbformat v4.5 notebook with exactly 5 code cells: (1) system deps + pip install, (2) Ollama install via `curl -fsSL https://ollama.com/install.sh | sh`, (3) Ollama start + model pull + verify, (4) AWS credential config, (5) worker script write + execution
    - Implement `parseNotebook(json)` that parses and validates `.ipynb` JSON structure
    - Embed `NotebookParams` values (model name, queue URLs, table name, worker script content) into the appropriate cells
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 3.2 Write property test for notebook generation round-trip
    - **Property 1: Notebook Generation Round-Trip**
    - For any valid `NotebookParams`, `generateNotebook()` → `JSON.stringify()` → `JSON.parse()` produces a valid notebook with `nbformat === 4`, non-empty `cells`, and exactly 5 code cells
    - **Validates: Requirements 3.1, 3.6, 12.6**

  - [x] 3.3 Write property test for notebook parameterized content embedding
    - **Property 2: Notebook Parameterized Content Embedding**
    - For any valid `NotebookParams`, the generated notebook contains cells with: `ollama pull <modelName>`, the request/response queue URLs, and the Ollama install script URL
    - **Validates: Requirements 3.3, 3.4, 3.5**

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement ComputeProvider interface and providers
  - [x] 5.1 Define ComputeProvider interface and types (`src/providers/types.ts`)
    - Define `ComputeProvider` interface with methods: `createSession`, `destroySession`, `getSessionStatus`, `executeCommand`, `getSessionLogs`
    - Define `SessionInfo`, `SessionCreateOptions`, `CommandResult`, and `AWSCredentialRef` types
    - Use generic string session identifiers that are provider-independent
    - _Requirements: 1.1, 1.2_

  - [x] 5.2 Implement Google Auth (`src/auth/google-auth.ts`)
    - Create `GoogleAuth` class supporting Service Account credentials (JSON key file) and OAuth 2.0 client credentials (refresh token flow)
    - Implement `getAccessToken()` with automatic refresh when expired
    - Implement `getDriveClient()` returning an authenticated Google Drive API v3 client
    - Request scopes for Google Drive and Colab APIs
    - Validate credentials file exists and contains required fields at startup
    - Retry token refresh up to 3 times; exit with OAuth error code on exhaustion
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 5.3 Implement ColabProvider (`src/providers/colab-provider.ts`)
    - Implement `ComputeProvider` for Google Colab free tier
    - `createSession`: serialize notebook JSON, upload to Google Drive via Drive API v3, connect Colab runtime (Colab API with Selenium fallback), execute cells, return `SessionInfo` with Drive `fileId` in metadata
    - `destroySession`: disconnect Colab runtime, delete notebook from Google Drive
    - `getSessionStatus`: query Colab API for runtime status
    - `executeCommand`: execute via Colab code execution API
    - `getSessionLogs`: retrieve cell outputs
    - Wait up to 120s for runtime `connected` state; return error with status and logs on timeout
    - Track session start time for 11-hour rotation check
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 1.5_

  - [x] 5.4 Implement LocalProvider (`src/providers/local-provider.ts`)
    - Implement `ComputeProvider` for local GPU testing without cloud credentials
    - `createSession`: verify local Ollama, start server if needed, pull models, start worker as child process
    - `destroySession`: stop worker and Ollama processes
    - `getSessionStatus`: check if local worker process is running
    - `executeCommand`: execute via `child_process`
    - `getSessionLogs`: read from local log file
    - _Requirements: 1.6_

  - [x] 5.5 Implement provider factory (`src/providers/factory.ts`)
    - Create `createProvider(config)` function that instantiates the correct provider based on `config.provider` field
    - Support `colab` and `local` provider types
    - New providers can be registered without modifying SessionManager or HealthMonitor
    - _Requirements: 1.3, 1.4_

  - [x] 5.6 Write property test for session rotation decision
    - **Property 10: Session Rotation Decision**
    - For any session start time and current time, rotation check returns `true` iff the difference exceeds 11 hours (39600000 ms)
    - **Validates: Requirements 2.7**

- [x] 6. Implement state management and session registration
  - [x] 6.1 Implement SessionRegistrar (`src/state/session-registrar.ts`)
    - Create `SessionRegistrar` class with DynamoDB DocumentClient and table name
    - `registerSession(record)`: PutItem with PK=`ORCHESTRATOR#{sessionId}`, SK=`META`, including all required fields and TTL (24h from creation)
    - `updateTimestamp(sessionId)`: UpdateItem to refresh `lastVerifiedAt` and extend TTL
    - `removeSession(sessionId)`: DeleteItem for orchestrator record
    - `getWorkerHeartbeat()`: GetItem on `SESSION#LATEST`, SK=`META` to read worker heartbeat
    - Implement `buildRecord()` helper that constructs the DynamoDB item with all required fields
    - Retry DynamoDB writes up to 3 times with exponential backoff (500ms, 1s, 2s)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 6.2 Write property test for orchestrator record completeness and TTL
    - **Property 6: Orchestrator Record Completeness and TTL**
    - For any valid session data, `buildRecord()` produces a DynamoDB item with all required fields (`PK`, `SK`, `sessionId`, `provider`, `models`, `createdAt`, `lastVerifiedAt`, `ttl`), and `ttl` equals `floor(createdAt epoch seconds) + 86400`
    - **Validates: Requirements 6.1, 6.5**

- [x] 7. Implement health monitoring and recovery
  - [x] 7.1 Implement RecoveryStrategy (`src/health/recovery.ts`)
    - Create `RecoveryStrategy` class with configurable `initialBackoffMs` (30000), `maxBackoffMs` (900000), `maxConsecutiveFailures` (5), `dormantRetryMs` (1800000)
    - `determineAction(healthResult, consecutiveFailures)`: return `restart_worker` if only heartbeat unhealthy and failures < 5, `recreate_session` if session unhealthy and failures < 5, `enter_dormant` if failures >= 5
    - `calculateBackoff(attempt)`: return `min(30000 * 2^attempt, 900000)` ms
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

  - [x] 7.2 Write property test for recovery action determination
    - **Property 7: Recovery Action Determination**
    - For any `HealthCheckResult` and consecutive failure count, verify the correct recovery action is returned per the rules
    - **Validates: Requirements 8.2, 8.3, 8.5**

  - [x] 7.3 Write property test for exponential backoff calculation
    - **Property 8: Exponential Backoff Calculation**
    - For any non-negative attempt number, `calculateBackoff(attempt)` returns `min(30000 * 2^attempt, 900000)` ms
    - **Validates: Requirements 8.4**

  - [x] 7.4 Implement HealthMonitor (`src/health/monitor.ts`)
    - Create `HealthMonitor` class that checks two dimensions: compute session status (via provider) and worker heartbeat freshness (via registrar)
    - `checkAll(sessionId)`: return `HealthCheckResult` with both dimension results, latency measurements, and `overall` boolean (true iff both healthy)
    - Heartbeat is healthy if age <= `heartbeatThresholdSeconds` (default 180)
    - `start(sessionId, onUnhealthy)`: begin periodic checks at `intervalMs`
    - `stop()`: stop the monitoring loop
    - Emit structured log entries for each health check with timestamp, sessionId, check type, result, and latency
    - _Requirements: 8.1, 8.6, 5.4, 5.5, 2.5_

  - [x] 7.5 Write property test for health check two-dimension reporting
    - **Property 9: Health Check Two-Dimension Reporting**
    - For any combination of session status and heartbeat freshness, `checkAll()` result contains both dimensions with boolean `healthy` and non-negative `latencyMs`, and `overall` is true iff both healthy
    - **Validates: Requirements 8.1**

  - [x] 7.6 Write property test for heartbeat freshness classification
    - **Property 12: Heartbeat Freshness Classification**
    - For any pair of timestamps and threshold, heartbeat check returns healthy iff difference <= threshold
    - **Validates: Requirements 5.4, 5.5**

  - [x] 7.7 Implement HealthEndpoint (`src/health/endpoint.ts`)
    - Create a local HTTP server on a configurable port that returns current health status of all monitored dimensions as JSON
    - Include session ID, provider, uptime, and per-dimension health results
    - _Requirements: 8.7_

- [x] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement session lifecycle orchestration
  - [x] 9.1 Implement SessionManager (`src/session/manager.ts`)
    - Create `SessionManager` class that orchestrates the full lifecycle: create session → install Ollama → pull models → start worker → wait for heartbeat → register in state store → monitor health → recover on failure → teardown
    - Wire `ComputeProvider`, `NotebookGenerator`, `SessionRegistrar`, `HealthMonitor`, and `RecoveryStrategy` together
    - On `startSession`: generate notebook, call provider `createSession`, verify Ollama install (retry start up to 2×), pull models (retry up to 2× with exponential backoff base 10s), wait for worker heartbeat (up to 180s), register orchestrator record, start health monitoring
    - On `stopSession`: stop health monitoring, mark session terminated in state store, remove orchestrator record, call provider `destroySession`
    - On health failure: delegate to `RecoveryStrategy.determineAction()`, execute the appropriate recovery action
    - Query session status at interval ≤ 60s; update orchestrator record `lastVerifiedAt` at interval ≤ 120s
    - Proactive session rotation when session age > 11 hours (start new, then teardown old)
    - Log model pull progress and total time
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 2.7, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.6, 6.1, 6.2, 6.3, 6.4_

  - [x] 9.2 Write unit tests for SessionManager
    - Test Ollama start retry count (max 2 retries)
    - Test model pull retry with exponential backoff (base 10s)
    - Test worker heartbeat wait timeout (180s)
    - Test session status change triggers recovery
    - Test DynamoDB write retry (max 3)
    - _Requirements: 4.3, 4.5, 5.3, 2.6, 6.6_

- [x] 10. Implement CLI entry point and graceful shutdown
  - [x] 10.1 Implement CLI (`src/cli.ts`)
    - Parse commands: `start`, `stop`, `status`, and `--dry-run` flag
    - `start`: load config, validate, log redacted config, create provider, start session manager, start health endpoint
    - `stop`: graceful shutdown sequence
    - `status`: query and display current session health
    - `--dry-run`: validate config and print resolved settings without creating sessions
    - Read AWS credentials from standard AWS credential chain (env vars, shared credentials file, IAM role)
    - _Requirements: 9.4, 9.5_

  - [x] 10.2 Implement graceful shutdown and global error boundary
    - Handle SIGTERM and SIGINT: stop health monitoring, mark sessions terminated in state store, destroy active sessions, flush logs, exit 0
    - Implement global error boundary: catch unhandled exceptions, log as critical, attempt graceful cleanup (10s timeout), exit 1
    - Clean up partially created resources (notebook files) on unrecoverable session creation errors
    - _Requirements: 10.3, 10.5, 10.6_

- [x] 11. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Integration wiring and documentation
  - [x] 12.1 Wire all components end-to-end and write integration tests
    - Verify end-to-end session lifecycle with mocked Google APIs and AWS SDK: create → setup → monitor → teardown
    - Verify auth token refresh flow with mocked Google OAuth
    - Verify recovery from simulated failures (stale heartbeat, terminated session)
    - Verify health HTTP endpoint returns correct JSON
    - Verify SIGTERM/SIGINT graceful shutdown sequence
    - _Requirements: 12.3, 2.1, 2.4, 7.4, 8.5, 8.7, 10.5_

  - [x] 12.2 Write integration tests for provider and auth flows
    - Test Colab session create → connect → execute with mocked Colab/Drive APIs
    - Test Colab session stop → disconnect → delete
    - Test service account token scopes
    - Test OAuth refresh token flow
    - Test credentials file validation at startup
    - _Requirements: 2.1, 2.2, 2.4, 7.1, 7.2, 7.3, 7.6_

  - [x] 12.3 Create README.md
    - Document: installation, configuration (all `GPU_ORCH_*` env vars), usage (CLI commands), provider interface (how to add new providers), and architecture overview
    - _Requirements: 11.7_

- [x] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major phase
- Property tests validate the 12 universal correctness properties from the design document
- Unit and integration tests use mocked Google APIs and AWS SDK clients — no real cloud calls during testing
- The package has zero `@cig/*` dependencies and is fully standalone
