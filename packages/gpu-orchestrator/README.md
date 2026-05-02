# GPU Orchestrator

Standalone TypeScript CLI for automating GPU compute session lifecycle for Ollama-based LLM inference.

The orchestrator manages the full lifecycle of remote GPU compute sessions: session creation on Google Colab (or other providers), Ollama installation and model pulling, worker script execution, session registration in the existing `llm-proxy-state` DynamoDB table, and continuous health monitoring with auto-recovery.

**No tunnel required.** The Colab worker communicates with AWS entirely via outbound HTTPS — polling SQS for inference requests, posting responses back, and writing heartbeats to DynamoDB. No inbound tunnel (Cloudflare, ngrok, etc.) is needed.

**Zero `@cig/*` dependencies.** This package is fully standalone with its own `package.json`, `tsconfig.json`, and `vitest.config.ts`. It mirrors the decoupling pattern established by `packages/llm-proxy/` and can be developed, tested, and deployed in isolation.

## Installation

```bash
# From the monorepo root
cd packages/gpu-orchestrator

# Install dependencies
pnpm install

# Build the project
pnpm run build
```

### Scripts

| Script          | Description                              |
|-----------------|------------------------------------------|
| `pnpm run build`  | Compile TypeScript to `dist/`         |
| `pnpm run dev`    | Watch mode for development            |
| `pnpm run lint`   | Type-check without emitting           |
| `pnpm run test`   | Run tests via vitest                  |
| `pnpm run start`  | Run `node dist/cli.js start`          |
| `pnpm run clean`  | Remove `dist/` and build artifacts    |

## Configuration

All settings are configured via environment variables with the `GPU_ORCH_` prefix. The orchestrator validates all values at startup using Zod schemas and exits with a descriptive error list if any required value is missing or invalid.

| Environment Variable             | Config Field                | Type / Values                        | Default            | Required |
|----------------------------------|-----------------------------|--------------------------------------|--------------------|----------|
| `GPU_ORCH_PROVIDER`              | `provider`                  | `colab` \| `local`                   | `colab`            | No       |
| `GPU_ORCH_MODEL_NAMES`           | `modelNames`                | Comma-separated model names          | —                  | Yes      |
| `GPU_ORCH_GOOGLE_CREDS_PATH`     | `googleCredentialsPath`     | Path to Google service account JSON  | —                  | No       |
| `GPU_ORCH_GOOGLE_CLIENT_ID`      | `googleOAuthClientId`       | Google OAuth 2.0 Client ID           | —                  | No       |
| `GPU_ORCH_GOOGLE_CLIENT_SECRET`  | `googleOAuthClientSecret`   | Google OAuth 2.0 Client Secret       | —                  | No       |
| `GPU_ORCH_AWS_REGION`            | `awsRegion`                 | AWS region string                    | `us-east-2`        | No       |
| `GPU_ORCH_REQUEST_QUEUE_URL`     | `requestQueueUrl`           | SQS queue URL                        | —                  | Yes      |
| `GPU_ORCH_RESPONSE_QUEUE_URL`    | `responseQueueUrl`          | SQS queue URL                        | —                  | Yes      |
| `GPU_ORCH_DYNAMO_TABLE`          | `dynamoTableName`           | DynamoDB table name                  | `llm-proxy-state`  | No       |
| `GPU_ORCH_HEALTH_INTERVAL`       | `healthCheckIntervalMs`     | Milliseconds (positive integer)      | `60000`            | No       |
| `GPU_ORCH_HEALTH_PORT`           | `healthEndpointPort`        | Port number (positive integer)       | `8787`             | No       |
| `GPU_ORCH_HEARTBEAT_THRESHOLD`   | `heartbeatThresholdSeconds` | Seconds (positive integer)           | `180`              | No       |
| `GPU_ORCH_LOG_LEVEL`             | `logLevel`                  | `debug` \| `info` \| `warn` \| `error` | `info`          | No       |

AWS credentials are read from the standard AWS credential chain (environment variables, shared credentials file, or IAM role) — no explicit access keys are required in the orchestrator configuration.

### Example `.env`

```bash
GPU_ORCH_PROVIDER=colab
GPU_ORCH_MODEL_NAMES=llama3,mistral
GPU_ORCH_GOOGLE_CREDS_PATH=/path/to/service-account.json
GPU_ORCH_AWS_REGION=us-east-2
GPU_ORCH_REQUEST_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/520900722378/llm-request-queue
GPU_ORCH_RESPONSE_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/520900722378/llm-response-queue
GPU_ORCH_DYNAMO_TABLE=llm-proxy-state
GPU_ORCH_LOG_LEVEL=info
```

## Usage

The orchestrator runs as a persistent CLI process. After building, use the following commands:

```bash
# Start the orchestrator (full lifecycle)
node dist/cli.js start

# Validate configuration without creating sessions
node dist/cli.js --dry-run

# Show how to stop a running instance
node dist/cli.js stop

# Query current session health
node dist/cli.js status

# Show help
node dist/cli.js --help
```

### Commands

| Command      | Description                                                                 |
|--------------|-----------------------------------------------------------------------------|
| `start`      | Load config, create provider, start session manager and health endpoint     |
| `stop`       | Display instructions for stopping a running orchestrator (send `SIGTERM`)   |
| `status`     | Query and display current session health                                    |
| `--dry-run`  | Validate configuration and print resolved settings, then exit               |

### Graceful Shutdown

The orchestrator handles `SIGTERM` and `SIGINT` signals by:

1. Stopping health monitoring
2. Stopping the health HTTP endpoint
3. Marking sessions as terminated in DynamoDB and destroying active compute sessions
4. Flushing logs and exiting cleanly

A global error boundary catches unhandled exceptions, logs them as critical errors, attempts graceful cleanup (10s timeout), and exits with a non-zero status code.

## Provider Interface

The orchestrator uses a provider-agnostic architecture. All compute backends implement the `ComputeProvider` interface, so the session manager, health monitor, and recovery strategy are decoupled from any specific provider.

### `ComputeProvider` Interface

```typescript
interface ComputeProvider {
  readonly providerName: string;

  createSession(options: SessionCreateOptions): Promise<SessionInfo>;
  destroySession(sessionId: string): Promise<void>;
  getSessionStatus(sessionId: string): Promise<SessionInfo>;
  executeCommand(sessionId: string, command: string): Promise<CommandResult>;
  getSessionLogs(sessionId: string, lines?: number): Promise<string>;
}
```

### Built-in Providers

- **`ColabProvider`** — Manages Google Colab free-tier sessions via Google Drive API and Colab API. Uploads generated notebooks, connects runtimes, and executes cells.
- **`LocalProvider`** — Runs Ollama locally for development and testing. No cloud credentials required.

### Adding a New Provider

1. Create a new file in `src/providers/` (e.g., `src/providers/kaggle-provider.ts`).
2. Implement the `ComputeProvider` interface:

   ```typescript
   import type { ComputeProvider, SessionInfo, SessionCreateOptions, CommandResult } from './types.js';

   export class KaggleProvider implements ComputeProvider {
     readonly providerName = 'kaggle';

     async createSession(options: SessionCreateOptions): Promise<SessionInfo> { /* ... */ }
     async destroySession(sessionId: string): Promise<void> { /* ... */ }
     async getSessionStatus(sessionId: string): Promise<SessionInfo> { /* ... */ }
     async executeCommand(sessionId: string, command: string): Promise<CommandResult> { /* ... */ }
     async getSessionLogs(sessionId: string, lines?: number): Promise<string> { /* ... */ }
   }
   ```

3. Register the provider in the factory (`src/providers/factory.ts`):

   ```typescript
   case 'kaggle':
     return new KaggleProvider(logger);
   ```

4. Add the new provider name to the `provider` enum in `src/config/schemas.ts`:

   ```typescript
   provider: z.enum(['colab', 'local', 'kaggle']).default('colab'),
   ```

No changes to `SessionManager`, `HealthMonitor`, or `RecoveryStrategy` are needed.

## Architecture Overview

The orchestrator follows a layered, component-based architecture. Each component has a single responsibility and communicates through well-defined interfaces.

### Key Components

| Component            | Path                              | Responsibility                                                        |
|----------------------|-----------------------------------|-----------------------------------------------------------------------|
| **CLI**              | `src/cli.ts`                      | Argument parsing, command dispatch, signal handling, error boundary    |
| **ConfigLoader**     | `src/config/loader.ts`            | `GPU_ORCH_*` env var loading, Zod validation, config redaction        |
| **ConfigSchemas**    | `src/config/schemas.ts`           | Zod schemas and env key mapping                                       |
| **SessionManager**   | `src/session/manager.ts`          | Orchestrates create → setup → monitor → recover → teardown lifecycle  |
| **ComputeProvider**  | `src/providers/types.ts`          | Provider-agnostic interface for compute backends                      |
| **ColabProvider**    | `src/providers/colab-provider.ts` | Google Colab lifecycle via Drive API + Colab API                      |
| **LocalProvider**    | `src/providers/local-provider.ts` | Local GPU testing without cloud credentials                           |
| **ProviderFactory**  | `src/providers/factory.ts`        | Instantiates the correct provider from config                         |
| **NotebookGenerator**| `src/notebook/generator.ts`       | Builds valid `.ipynb` JSON programmatically from parameters           |
| **GoogleAuth**       | `src/auth/google-auth.ts`         | OAuth 2.0 and Service Account token management                       |
| **SessionRegistrar** | `src/state/session-registrar.ts`  | DynamoDB `ORCHESTRATOR#` record management and heartbeat reads        |
| **HealthMonitor**    | `src/health/monitor.ts`           | Two-dimension health checks (session status + worker heartbeat)       |
| **RecoveryStrategy** | `src/health/recovery.ts`          | Exponential backoff recovery with component-level granularity         |
| **HealthEndpoint**   | `src/health/endpoint.ts`          | Local HTTP server returning health status as JSON                     |
| **Logger**           | `src/lib/logger.ts`               | Structured JSON logging                                               |
| **Errors**           | `src/lib/errors.ts`               | Typed error classes with categories                                   |

### Session Lifecycle

```
CLI start
  → Load & validate config (Zod)
  → Create provider (factory)
  → Generate notebook (.ipynb)
  → Create compute session (provider)
  → Install Ollama + pull models
  → Start worker script (SQS polling + heartbeats)
  → Wait for worker heartbeat in DynamoDB (up to 180s)
  → Register orchestrator record in DynamoDB
  → Start health monitoring loop (every 60s)
  → Start health HTTP endpoint
  → On failure → RecoveryStrategy (restart worker / recreate session / dormant)
  → On SIGTERM/SIGINT → graceful shutdown
```

### Health Monitoring

The health monitor checks two dimensions at each interval:

1. **Compute session status** — Is the runtime still connected and running?
2. **Worker heartbeat freshness** — Has the worker written a DynamoDB heartbeat within the threshold (default: 180s)?

Recovery actions are determined by the failure pattern:

| Condition                                        | Action             |
|--------------------------------------------------|--------------------|
| Heartbeat stale, session healthy, failures < 5   | `restart_worker`   |
| Session unhealthy, failures < 5                  | `recreate_session` |
| 5+ consecutive failures                          | `enter_dormant`    |

Backoff follows `min(30000 × 2^attempt, 900000)` milliseconds.

### DynamoDB Integration

The orchestrator extends the existing `llm-proxy-state` single-table design. No new tables are created.

- **Writes**: `ORCHESTRATOR#{sessionId}` records with session metadata and 24h TTL
- **Reads**: `SESSION#LATEST` records to check worker heartbeat freshness

## Testing

```bash
# Run all tests
pnpm run test

# Run tests in watch mode
pnpm run test -- --watch
```

The test suite includes:

- **Property-based tests** (fast-check) — Verify universal correctness properties across randomized inputs for notebook generation, config validation, recovery logic, health checks, and more
- **Unit tests** — Cover individual components (providers, auth, config, logger, errors)
- **Integration tests** — End-to-end session lifecycle with mocked Google APIs and AWS SDK clients

## License

See the root [LICENSE](../../LICENSE) file.
