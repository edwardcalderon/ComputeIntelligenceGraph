# Requirements Document

## Introduction

This feature creates a new `packages/gpu-orchestrator/` package that automates the lifecycle of GPU compute sessions for running Ollama-based LLM inference. The orchestrator manages session creation, Ollama installation and model pulling, worker script execution, and session registration in the existing llm-proxy DynamoDB state store. Communication between the Colab worker and AWS uses the existing SQS-based pull pattern (the worker polls SQS outbound — no inbound tunnel required). The package is designed to be provider-agnostic: the compute provider (Google Colab, Kaggle, local GPU) is abstracted behind a common interface so that switching providers is a configuration change rather than a code rewrite. Google Colab (free tier) is the primary provider. The orchestrator is 100% TypeScript, independently deployable, and has zero `@cig/*` dependencies — mirroring the decoupling pattern established by `packages/llm-proxy/`.

## Glossary

- **Orchestrator**: The TypeScript application in `packages/gpu-orchestrator/` that manages the full lifecycle of remote GPU compute sessions
- **Compute_Provider**: An abstraction representing a remote GPU compute environment (Google Colab, Kaggle, local GPU, etc.) behind a common interface
- **Colab_Provider**: The concrete Compute_Provider implementation that manages Google Colab free-tier sessions via the Colab API and Selenium-based automation
- **Colab_Session**: A single Google Colab runtime instance (up to ~12 hours on free tier) managed by the Colab_Provider
- **Session_Manager**: The component responsible for creating, monitoring, health-checking, and tearing down compute sessions
- **Notebook_Generator**: The component that programmatically creates Jupyter notebook (.ipynb) files containing the worker setup code (Ollama install, model pull, SQS polling)
- **State_Store**: The existing DynamoDB table (`llm-proxy-state`) used by the llm-proxy for session tracking and heartbeats
- **Google_OAuth**: Google OAuth 2.0 authentication flow used to obtain access tokens for the Colab API
- **Service_Account**: The GCloud service account (`cig-technology@cig-technology-495016.iam.gserviceaccount.com`) used for programmatic access
- **Provider_Config**: A configuration object that specifies which Compute_Provider to use and its provider-specific settings
- **Health_Monitor**: The component that periodically checks compute session health (runtime status, Ollama responsiveness, worker heartbeat) and triggers recovery actions
- **Recovery_Strategy**: The automated response to a detected failure — restart the session, re-pull the model, or recreate the full session
- **Ollama**: The open-source LLM inference server installed and run inside the compute session
- **Worker_Script**: The Python code (derived from `packages/llm-proxy/colab/worker.py`) that runs inside the compute session to poll SQS and forward requests to Ollama
- **Worker_Heartbeat**: The periodic DynamoDB heartbeat written by the Worker_Script, used by the Health_Monitor to verify the worker is alive and processing requests

## Requirements

### Requirement 1: Provider-Agnostic Compute Abstraction

**User Story:** As a developer, I want the compute provider to be abstracted behind a common interface, so that I can switch from Google Colab to Kaggle or a local GPU by changing configuration rather than rewriting orchestration logic.

#### Acceptance Criteria

1. THE Orchestrator SHALL define a `ComputeProvider` TypeScript interface with methods: `createSession`, `destroySession`, `getSessionStatus`, `executeCommand`, and `getSessionLogs`
2. THE `ComputeProvider` interface SHALL use generic session identifiers (strings) that are provider-independent
3. THE Orchestrator SHALL load the active Compute_Provider implementation based on a `provider` field in the Provider_Config
4. WHEN a new Compute_Provider implementation is registered, THE Orchestrator SHALL use the new provider without modifications to the Session_Manager or Health_Monitor
5. THE Orchestrator SHALL include a `ColabProvider` class that implements the `ComputeProvider` interface for Google Colab free-tier sessions
6. THE Orchestrator SHALL include a `LocalProvider` class that implements the `ComputeProvider` interface for local GPU testing without requiring cloud credentials
7. THE Provider_Config SHALL be validated at startup using Zod schemas, and IF the configuration is invalid, THEN THE Orchestrator SHALL exit with a descriptive error message

### Requirement 2: Google Colab Session Lifecycle Management

**User Story:** As a system operator, I want the orchestrator to automatically create, monitor, and tear down Google Colab sessions, so that I do not need to manually manage notebook runtimes.

#### Acceptance Criteria

1. WHEN the Orchestrator receives a `startSession` command, THE Colab_Provider SHALL create a new Colab_Session by uploading a generated notebook to Google Drive and connecting a Colab runtime
2. WHEN a Colab_Session is created, THE Colab_Provider SHALL wait for the runtime to reach a `connected` state before returning the session identifier, with a timeout of 120 seconds
3. IF the Colab_Session fails to reach `connected` state within 120 seconds, THEN THE Colab_Provider SHALL return an error with the runtime status and any available error logs
4. WHEN the Orchestrator receives a `stopSession` command, THE Colab_Provider SHALL disconnect the Colab runtime and delete the temporary notebook from Google Drive
5. WHILE a Colab_Session is active, THE Session_Manager SHALL query the session status at an interval no greater than 60 seconds
6. IF the Session_Manager detects that a Colab_Session has transitioned to a `disconnected` or `error` state, THEN THE Session_Manager SHALL trigger the Recovery_Strategy
7. THE Colab_Provider SHALL track the session start time and IF the session has been running for more than 11 hours, THEN THE Colab_Provider SHALL proactively initiate a graceful session rotation (start new session, then tear down old session)

### Requirement 3: Notebook Auto-Generation

**User Story:** As a system operator, I want the orchestrator to automatically generate compute notebooks with the correct worker setup code, so that I do not need to manually create or update notebooks.

#### Acceptance Criteria

1. THE Notebook_Generator SHALL produce a valid Jupyter notebook (.ipynb) JSON structure containing setup cells for: system dependency installation, Ollama installation, model pulling, AWS credential configuration, and worker script execution
2. THE Notebook_Generator SHALL accept parameters for: model name, AWS credentials reference, SQS queue URLs, and DynamoDB table name
3. WHEN the Notebook_Generator produces a notebook, THE notebook SHALL include a cell that installs Ollama using the official install script (`curl -fsSL https://ollama.com/install.sh | sh`)
4. WHEN the Notebook_Generator produces a notebook, THE notebook SHALL include a cell that pulls the specified model using `ollama pull <model_name>` and verifies the model is available via `ollama list`
5. WHEN the Notebook_Generator produces a notebook, THE notebook SHALL include a cell that configures AWS credentials and starts the Worker_Script to poll SQS and forward requests to the local Ollama instance
6. FOR ALL valid parameter combinations, generating a notebook and then parsing the resulting JSON SHALL produce a structurally valid Jupyter notebook with the expected number of cells (round-trip property)

### Requirement 4: Ollama Installation and Model Management

**User Story:** As a system operator, I want the orchestrator to automatically install Ollama and pull the required models inside the compute session, so that the inference server is ready to serve requests without manual intervention.

#### Acceptance Criteria

1. WHEN a compute session reaches `connected` state, THE Orchestrator SHALL execute the Ollama installation command inside the session and verify that the `ollama` binary is available on the PATH
2. WHEN Ollama is installed, THE Orchestrator SHALL start the Ollama server process and verify it is listening on `localhost:11434` within 30 seconds
3. IF the Ollama server fails to start within 30 seconds, THEN THE Orchestrator SHALL retry the start command up to 2 times before reporting an error
4. WHEN the Ollama server is running, THE Orchestrator SHALL pull each model specified in the Provider_Config and verify each model appears in the `ollama list` output
5. IF a model pull fails, THEN THE Orchestrator SHALL retry the pull up to 2 times with exponential backoff (base 10 seconds) before reporting an error
6. THE Orchestrator SHALL log the download progress and total time for each model pull operation
7. WHILE the compute session is active, THE Health_Monitor SHALL verify Ollama responsiveness by checking the Worker_Heartbeat in the State_Store at an interval no greater than 120 seconds

### Requirement 5: Worker Connectivity Verification

**User Story:** As a system operator, I want the orchestrator to verify that the worker inside the compute session can communicate with AWS services (SQS and DynamoDB), so that I know the inference pipeline is functional end-to-end.

#### Acceptance Criteria

1. WHEN the Worker_Script starts inside the compute session, THE Worker_Script SHALL register a session in the State_Store and begin sending heartbeats (this is handled by the existing `packages/llm-proxy/colab/worker.py`)
2. WHEN the Orchestrator detects a new Worker_Heartbeat in the State_Store within 180 seconds of session creation, THE Orchestrator SHALL consider the worker connectivity verified
3. IF the Orchestrator does not detect a Worker_Heartbeat within 180 seconds, THEN THE Orchestrator SHALL log an error and trigger the Recovery_Strategy
4. WHILE the compute session is active, THE Health_Monitor SHALL check the Worker_Heartbeat freshness in the State_Store at an interval no greater than 120 seconds
5. IF the Worker_Heartbeat is older than 180 seconds, THEN THE Health_Monitor SHALL consider the worker unhealthy and trigger the Recovery_Strategy
6. THE Orchestrator SHALL NOT require any inbound tunnel or external connectivity to the compute session — all communication uses the existing SQS pull-based pattern where the worker makes outbound HTTPS calls to AWS

### Requirement 6: Session Registration in State Store

**User Story:** As the llm-proxy system, I want the orchestrator to register active sessions in DynamoDB, so that the proxy can discover and route requests to available workers.

#### Acceptance Criteria

1. WHEN a worker heartbeat is verified, THE Orchestrator SHALL write a record to the State_Store with partition key `ORCHESTRATOR#{sessionId}`, sort key `META`, containing the session ID, provider type, model list, and creation timestamp
2. THE Orchestrator SHALL update the `SESSION#LATEST` record in the State_Store with the orchestrator session metadata so the llm-proxy can discover the active worker
3. WHILE the compute session is active, THE Orchestrator SHALL update the orchestrator record's `lastVerifiedAt` timestamp at an interval no greater than 120 seconds
4. WHEN a compute session is terminated, THE Orchestrator SHALL delete the orchestrator record from the State_Store
5. THE State_Store orchestrator records SHALL include a TTL value of 24 hours from the last update to ensure stale records are automatically cleaned up
6. IF the State_Store write fails, THEN THE Orchestrator SHALL retry the write up to 3 times with exponential backoff before logging an error and continuing operation

### Requirement 7: Google OAuth 2.0 Authentication

**User Story:** As a system operator, I want the orchestrator to authenticate with Google using OAuth 2.0 or a service account, so that it can programmatically access the Colab API and Google Drive.

#### Acceptance Criteria

1. THE Orchestrator SHALL support authentication via Google Service_Account credentials loaded from a JSON key file path specified in the Provider_Config
2. THE Orchestrator SHALL support authentication via Google OAuth 2.0 client credentials (Client ID and Client Secret) with a refresh token flow
3. WHEN using Service_Account authentication, THE Orchestrator SHALL request access tokens scoped to Google Drive and Colab APIs
4. WHEN an access token expires, THE Orchestrator SHALL automatically refresh the token using the refresh token or service account key without interrupting active sessions
5. IF authentication fails after 3 retry attempts, THEN THE Orchestrator SHALL log the error with the specific OAuth error code and exit with a non-zero status code
6. THE Orchestrator SHALL validate that the credentials file exists and contains the required fields at startup, and IF validation fails, THEN THE Orchestrator SHALL exit with a descriptive error message

### Requirement 8: Health Monitoring and Auto-Recovery

**User Story:** As a system operator, I want the orchestrator to automatically detect and recover from failures, so that the inference service remains available without manual intervention.

#### Acceptance Criteria

1. THE Health_Monitor SHALL check two health dimensions at each monitoring interval: compute session runtime status and Worker_Heartbeat freshness in the State_Store
2. WHEN the Health_Monitor detects that the Worker_Heartbeat is stale but the compute session is still running, THE Recovery_Strategy SHALL attempt to restart the worker inside the existing session
3. WHEN the Health_Monitor detects that the compute session runtime has terminated unexpectedly, THE Recovery_Strategy SHALL create a new session and re-run the full setup sequence (Ollama install, model pull, worker start)
4. THE Recovery_Strategy SHALL implement exponential backoff for recovery attempts, starting at 30 seconds and doubling up to a maximum of 15 minutes between attempts
5. IF the Recovery_Strategy fails to recover after 5 consecutive attempts, THEN THE Orchestrator SHALL log a critical error, send an alert (if SNS is configured), and enter a dormant state that retries every 30 minutes
6. THE Health_Monitor SHALL emit structured log entries for each health check containing: timestamp, session ID, check type, result (healthy/unhealthy), and latency in milliseconds
7. THE Orchestrator SHALL expose a local HTTP health endpoint on a configurable port that returns the current health status of all monitored dimensions as JSON

### Requirement 9: Configuration and Environment Management

**User Story:** As a developer, I want all orchestrator settings to be configurable via environment variables and a typed configuration schema, so that I can deploy the orchestrator in different environments without code changes.

#### Acceptance Criteria

1. THE Orchestrator SHALL load configuration from environment variables with a `GPU_ORCH_` prefix (e.g., `GPU_ORCH_PROVIDER`, `GPU_ORCH_MODEL_NAME`)
2. THE Orchestrator SHALL validate all configuration values at startup using Zod schemas and IF any required value is missing or invalid, THEN THE Orchestrator SHALL exit with a list of all validation errors
3. THE Provider_Config SHALL include fields for: provider type, Google credentials path, OAuth client ID, OAuth client secret, model names (comma-separated), AWS region, SQS queue URLs, DynamoDB table name, and health check interval
4. THE Orchestrator SHALL support a `--dry-run` CLI flag that validates configuration and prints the resolved settings without creating any sessions
5. THE Orchestrator SHALL read AWS credentials from the standard AWS credential chain (environment variables, shared credentials file, or IAM role) rather than requiring explicit access keys in the configuration
6. THE Orchestrator SHALL log the resolved configuration at startup with sensitive values (credentials, tokens, keys) redacted

### Requirement 10: Error Handling and Logging

**User Story:** As a system operator, I want comprehensive error handling and structured logging, so that I can diagnose issues quickly and the system degrades gracefully.

#### Acceptance Criteria

1. THE Orchestrator SHALL use structured JSON logging with fields: timestamp, level, component, sessionId, message, and optional error details
2. WHEN an error occurs in any component, THE Orchestrator SHALL log the error with full context (component name, session ID, operation, error message, stack trace) and continue operating if the error is recoverable
3. IF an unrecoverable error occurs during session creation, THEN THE Orchestrator SHALL clean up any partially created resources (notebook files) before exiting
4. THE Orchestrator SHALL categorize errors into: `auth_error`, `provider_error`, `ollama_error`, `state_store_error`, and `config_error`
5. WHEN the Orchestrator process receives a SIGTERM or SIGINT signal, THE Orchestrator SHALL gracefully shut down by: stopping health monitoring, marking sessions as terminated in the State_Store, and destroying active compute sessions
6. THE Orchestrator SHALL implement a global error boundary that catches unhandled exceptions, logs them as critical errors, attempts graceful cleanup, and exits with a non-zero status code

### Requirement 11: Package Structure and Independence

**User Story:** As a developer, I want the gpu-orchestrator package to be fully independent from the CIG monorepo packages, so that it can be developed, tested, and deployed in isolation.

#### Acceptance Criteria

1. THE `packages/gpu-orchestrator/` package SHALL have zero imports from or dependencies on any `@cig/*` package
2. THE package SHALL use TypeScript 5.4+ with strict mode enabled and ESM module format
3. THE package SHALL include a `package.json` with name `@gpu-orchestrator/app` and scripts for: `build`, `dev`, `lint`, `test`, `start`, and `clean`
4. THE package SHALL include a `vitest.config.ts` for test configuration and use `vitest` as the test runner
5. THE package SHALL include a `tsconfig.json` that extends no external configuration and targets ES2022 with Node16 module resolution
6. THE package SHALL be executable as a standalone CLI application via `node dist/cli.js` or through a `bin` entry in `package.json`
7. THE package SHALL include a README.md documenting: installation, configuration, usage, provider interface, and architecture overview

### Requirement 12: Testing Strategy

**User Story:** As a developer, I want comprehensive tests including property-based tests for core logic, so that I can verify correctness across a wide range of inputs and configurations.

#### Acceptance Criteria

1. THE package SHALL include property-based tests using `fast-check` for: notebook generation round-trip (generate → parse → validate structure), configuration validation (valid configs accepted, invalid configs rejected), and provider interface contract verification
2. THE package SHALL include unit tests for: each ComputeProvider method, Notebook_Generator output structure, Health_Monitor check logic, and configuration parsing
3. THE package SHALL include integration tests with mocked Google APIs and AWS SDK clients for: end-to-end session lifecycle (create → setup → monitor → teardown), authentication token refresh flow, and recovery from simulated failures
4. THE package SHALL achieve a minimum of 80% code coverage across all source files as measured by vitest coverage
5. FOR ALL valid Provider_Config objects, serializing the config to JSON and parsing it back SHALL produce an equivalent configuration object (round-trip property)
6. FOR ALL generated notebooks, the number of code cells SHALL equal the expected count based on the input parameters (metamorphic property)
