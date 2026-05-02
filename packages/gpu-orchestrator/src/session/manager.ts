/**
 * Session lifecycle orchestration.
 *
 * The {@link SessionManager} wires together the compute provider, notebook
 * generator, session registrar, health monitor, and recovery strategy to
 * manage the full lifecycle of a GPU compute session:
 *
 *   create session → install Ollama → pull models → start worker →
 *   wait for heartbeat → register in state store → monitor health →
 *   recover on failure → teardown
 *
 * @module
 */

import { generateNotebook } from '../notebook/generator.js';
import { shouldRotateSession } from '../providers/session-rotation.js';
import type { ComputeProvider, SessionInfo } from '../providers/types.js';
import type { SessionRegistrar } from '../state/session-registrar.js';
import type { HealthMonitor } from '../health/monitor.js';
import type { RecoveryStrategy } from '../health/recovery.js';
import type { HealthCheckResult } from '../health/recovery.js';
import type { OrchestratorConfig } from '../config/schemas.js';
import type { Logger } from '../lib/logger.js';
import { ProviderError, OllamaError } from '../lib/errors.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum retries for Ollama start command. */
const OLLAMA_START_MAX_RETRIES = 2;

/** Maximum retries for model pull. */
const MODEL_PULL_MAX_RETRIES = 2;

/** Base delay in ms for model pull exponential backoff. */
const MODEL_PULL_BACKOFF_BASE_MS = 10_000;

/** Maximum time to wait for worker heartbeat (ms). */
const HEARTBEAT_WAIT_TIMEOUT_MS = 180_000;

/** Polling interval when waiting for worker heartbeat (ms). */
const HEARTBEAT_POLL_INTERVAL_MS = 5_000;

/** Interval for updating the orchestrator record timestamp (ms). */
const TIMESTAMP_UPDATE_INTERVAL_MS = 120_000;

/** Interval for querying session status (ms). Must be ≤ 60s. */
const SESSION_STATUS_INTERVAL_MS = 60_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// SessionManager
// ---------------------------------------------------------------------------

/**
 * Orchestrates the full lifecycle of a GPU compute session.
 *
 * Coordinates the compute provider, session registrar, health monitor,
 * and recovery strategy to create, monitor, and tear down sessions.
 */
export class SessionManager {
  private activeSessionId: string | null = null;
  private activeSessionStartedAt: string | null = null;
  private consecutiveFailures = 0;
  private timestampInterval: ReturnType<typeof setInterval> | null = null;
  private rotationInterval: ReturnType<typeof setInterval> | null = null;
  private isRotating = false;

  constructor(
    private readonly provider: ComputeProvider,
    private readonly registrar: SessionRegistrar,
    private readonly healthMonitor: HealthMonitor,
    private readonly recoveryStrategy: RecoveryStrategy,
    private readonly logger: Logger,
    private readonly config: OrchestratorConfig,
  ) {}

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Start a new GPU compute session.
   *
   * 1. Generate notebook from config
   * 2. Create session via provider
   * 3. Verify Ollama install (retry start up to 2×)
   * 4. Pull models (retry up to 2× with exponential backoff base 10s)
   * 5. Wait for worker heartbeat (up to 180s)
   * 6. Register orchestrator record
   * 7. Start health monitoring
   * 8. Start timestamp update interval
   * 9. Start session rotation check
   *
   * @returns The session info for the newly created session.
   */
  async startSession(): Promise<SessionInfo> {
    this.logger.info('Starting new GPU compute session');

    // 1. Generate notebook
    const notebook = generateNotebook({
      modelName: this.config.modelNames[0],
      awsRegion: this.config.awsRegion,
      requestQueueUrl: this.config.requestQueueUrl,
      responseQueueUrl: this.config.responseQueueUrl,
      dynamoTableName: this.config.dynamoTableName,
      workerScriptContent: '# Worker script placeholder',
    });

    this.logger.info('Notebook generated successfully');

    // 2. Create session via provider
    const sessionInfo = await this.provider.createSession({
      notebook,
      models: this.config.modelNames,
      awsConfig: { region: this.config.awsRegion },
    });

    this.activeSessionId = sessionInfo.sessionId;
    this.activeSessionStartedAt = sessionInfo.startedAt;
    this.consecutiveFailures = 0;

    this.logger.info(
      `Session created: id=${sessionInfo.sessionId}, provider=${sessionInfo.provider}, status=${sessionInfo.status}`,
    );

    // 3. Verify Ollama install — retry start up to 2×
    await this.verifyOllamaStart(sessionInfo.sessionId);

    // 4. Pull models — retry up to 2× with exponential backoff
    await this.pullModels(sessionInfo.sessionId);

    // 5. Wait for worker heartbeat (up to 180s)
    await this.waitForHeartbeat();

    // 6. Register orchestrator record
    const now = new Date().toISOString();
    await this.registrar.registerSession({
      sessionId: sessionInfo.sessionId,
      provider: sessionInfo.provider,
      models: this.config.modelNames,
      createdAt: sessionInfo.startedAt,
      lastVerifiedAt: now,
      ttl: Math.floor(Date.parse(sessionInfo.startedAt) / 1000) + 86_400,
    });

    this.logger.info(
      `Orchestrator record registered for session ${sessionInfo.sessionId}`,
    );

    // 7. Start health monitoring
    this.healthMonitor.start(sessionInfo.sessionId, (result) => {
      void this.handleHealthFailure(result);
    });

    this.logger.info('Health monitoring started');

    // 8. Start timestamp update interval (every 120s)
    this.startTimestampUpdates(sessionInfo.sessionId);

    // 9. Start session rotation check
    this.startRotationCheck();

    return sessionInfo;
  }

  /**
   * Stop the active session and clean up all resources.
   *
   * 1. Stop health monitoring
   * 2. Stop timestamp update interval
   * 3. Stop rotation check interval
   * 4. Remove orchestrator record from DynamoDB
   * 5. Destroy session via provider
   */
  async stopSession(): Promise<void> {
    const sessionId = this.activeSessionId;
    if (!sessionId) {
      this.logger.warn('No active session to stop');
      return;
    }

    this.logger.info(`Stopping session ${sessionId}`);

    // 1. Stop health monitoring
    this.healthMonitor.stop();

    // 2. Stop timestamp update interval
    this.stopTimestampUpdates();

    // 3. Stop rotation check interval
    this.stopRotationCheck();

    // 4. Remove orchestrator record
    try {
      await this.registrar.removeSession(sessionId);
      this.logger.info(`Orchestrator record removed for session ${sessionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to remove orchestrator record for session ${sessionId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    // 5. Destroy session via provider
    try {
      await this.provider.destroySession(sessionId);
      this.logger.info(`Session ${sessionId} destroyed`);
    } catch (error) {
      this.logger.error(
        `Failed to destroy session ${sessionId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    this.activeSessionId = null;
    this.activeSessionStartedAt = null;
    this.consecutiveFailures = 0;
  }

  /**
   * Handle a health check failure by delegating to the recovery strategy.
   *
   * Increments the consecutive failure counter, determines the recovery
   * action, and executes it with appropriate backoff.
   */
  async handleHealthFailure(result: HealthCheckResult): Promise<void> {
    this.consecutiveFailures++;

    this.logger.warn(
      `Health failure #${this.consecutiveFailures}: overall=${result.overall}, ` +
        `session=${result.checks.session.healthy}, heartbeat=${result.checks.workerHeartbeat.healthy}`,
    );

    const action = this.recoveryStrategy.determineAction(
      result,
      this.consecutiveFailures,
    );

    this.logger.info(`Recovery action determined: ${action.type}`);

    // Calculate backoff delay before executing recovery
    const backoffMs = this.recoveryStrategy.calculateBackoff(
      this.consecutiveFailures - 1,
    );

    switch (action.type) {
      case 'restart_worker': {
        this.logger.info(
          `Restarting worker in session ${result.sessionId} after ${backoffMs}ms backoff`,
        );
        await sleep(backoffMs);
        try {
          await this.provider.executeCommand(
            result.sessionId,
            'python /content/worker.py &',
          );
          this.logger.info('Worker restart command executed');
        } catch (error) {
          this.logger.error(
            'Failed to restart worker',
            error instanceof Error ? error : new Error(String(error)),
          );
        }
        break;
      }

      case 'recreate_session': {
        this.logger.info(
          `Recreating session after ${backoffMs}ms backoff`,
        );
        await sleep(backoffMs);
        try {
          await this.stopSession();
          await this.startSession();
          this.logger.info('Session recreated successfully');
        } catch (error) {
          this.logger.error(
            'Failed to recreate session',
            error instanceof Error ? error : new Error(String(error)),
          );
        }
        break;
      }

      case 'enter_dormant': {
        const dormantMs = this.recoveryStrategy.dormantRetryMs;
        this.logger.critical(
          `Entering dormant state after ${this.consecutiveFailures} consecutive failures. ` +
            `Will retry in ${dormantMs}ms`,
        );
        await sleep(dormantMs);
        // Reset failure count and attempt recovery
        this.consecutiveFailures = 0;
        try {
          await this.stopSession();
          await this.startSession();
          this.logger.info('Recovered from dormant state');
        } catch (error) {
          this.logger.error(
            'Failed to recover from dormant state',
            error instanceof Error ? error : new Error(String(error)),
          );
        }
        break;
      }
    }
  }

  /** Returns the currently active session ID, or `null` if none. */
  get currentSessionId(): string | null {
    return this.activeSessionId;
  }

  /** Returns the number of consecutive health failures. */
  get currentConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  // -----------------------------------------------------------------------
  // Private — Ollama verification
  // -----------------------------------------------------------------------

  /**
   * Verify Ollama is installed and start the server, retrying up to 2 times.
   */
  private async verifyOllamaStart(sessionId: string): Promise<void> {
    this.logger.info('Verifying Ollama installation and starting server');

    for (let attempt = 0; attempt <= OLLAMA_START_MAX_RETRIES; attempt++) {
      try {
        const result = await this.provider.executeCommand(
          sessionId,
          'ollama serve &',
        );

        if (result.exitCode === 0) {
          this.logger.info(
            `Ollama server started successfully (attempt ${attempt + 1})`,
          );
          // Wait briefly for server to become ready
          await sleep(5_000);
          return;
        }

        this.logger.warn(
          `Ollama start attempt ${attempt + 1} failed with exit code ${result.exitCode}: ${result.stderr}`,
        );
      } catch (error) {
        this.logger.warn(
          `Ollama start attempt ${attempt + 1} threw an error`,
          error instanceof Error ? error : new Error(String(error)),
        );
      }

      if (attempt < OLLAMA_START_MAX_RETRIES) {
        this.logger.info(
          `Retrying Ollama start (attempt ${attempt + 2}/${OLLAMA_START_MAX_RETRIES + 1})`,
        );
        await sleep(5_000);
      }
    }

    throw new OllamaError(
      `Ollama server failed to start after ${OLLAMA_START_MAX_RETRIES + 1} attempts`,
      { component: 'SessionManager', sessionId, operation: 'verifyOllamaStart' },
    );
  }

  // -----------------------------------------------------------------------
  // Private — Model pulling
  // -----------------------------------------------------------------------

  /**
   * Pull all configured models, retrying each up to 2 times with
   * exponential backoff (base 10s).
   */
  private async pullModels(sessionId: string): Promise<void> {
    for (const model of this.config.modelNames) {
      await this.pullModel(sessionId, model);
    }
  }

  /**
   * Pull a single model with retry and exponential backoff.
   */
  private async pullModel(sessionId: string, model: string): Promise<void> {
    this.logger.info(`Pulling model: ${model}`);
    const pullStart = Date.now();

    for (let attempt = 0; attempt <= MODEL_PULL_MAX_RETRIES; attempt++) {
      try {
        const result = await this.provider.executeCommand(
          sessionId,
          `ollama pull ${model}`,
        );

        if (result.exitCode === 0) {
          const elapsed = Date.now() - pullStart;
          this.logger.info(
            `Model ${model} pulled successfully in ${elapsed}ms (attempt ${attempt + 1})`,
          );

          // Log progress output if available
          if (result.stdout) {
            this.logger.info(`Model pull output: ${result.stdout}`);
          }
          return;
        }

        this.logger.warn(
          `Model pull attempt ${attempt + 1} for ${model} failed with exit code ${result.exitCode}: ${result.stderr}`,
        );
      } catch (error) {
        this.logger.warn(
          `Model pull attempt ${attempt + 1} for ${model} threw an error`,
          error instanceof Error ? error : new Error(String(error)),
        );
      }

      if (attempt < MODEL_PULL_MAX_RETRIES) {
        const backoffMs = MODEL_PULL_BACKOFF_BASE_MS * Math.pow(2, attempt);
        this.logger.info(
          `Retrying model pull for ${model} in ${backoffMs}ms (attempt ${attempt + 2}/${MODEL_PULL_MAX_RETRIES + 1})`,
        );
        await sleep(backoffMs);
      }
    }

    const elapsed = Date.now() - pullStart;
    throw new OllamaError(
      `Failed to pull model ${model} after ${MODEL_PULL_MAX_RETRIES + 1} attempts (${elapsed}ms)`,
      { component: 'SessionManager', sessionId, operation: 'pullModel' },
    );
  }

  // -----------------------------------------------------------------------
  // Private — Heartbeat waiting
  // -----------------------------------------------------------------------

  /**
   * Poll the registrar for a worker heartbeat, waiting up to 180s.
   */
  private async waitForHeartbeat(): Promise<void> {
    this.logger.info(
      `Waiting for worker heartbeat (timeout: ${HEARTBEAT_WAIT_TIMEOUT_MS}ms, poll interval: ${HEARTBEAT_POLL_INTERVAL_MS}ms)`,
    );

    const deadline = Date.now() + HEARTBEAT_WAIT_TIMEOUT_MS;

    while (Date.now() < deadline) {
      try {
        const heartbeat = await this.registrar.getWorkerHeartbeat();
        if (heartbeat) {
          this.logger.info(
            `Worker heartbeat detected: lastHeartbeatAt=${heartbeat.lastHeartbeatAt}, status=${heartbeat.status}`,
          );
          return;
        }
      } catch (error) {
        this.logger.warn(
          'Error polling for worker heartbeat',
          error instanceof Error ? error : new Error(String(error)),
        );
      }

      await sleep(HEARTBEAT_POLL_INTERVAL_MS);
    }

    throw new ProviderError(
      `Worker heartbeat not detected within ${HEARTBEAT_WAIT_TIMEOUT_MS}ms`,
      { component: 'SessionManager', operation: 'waitForHeartbeat' },
    );
  }

  // -----------------------------------------------------------------------
  // Private — Timestamp updates
  // -----------------------------------------------------------------------

  /**
   * Start periodic updates of the orchestrator record's `lastVerifiedAt`
   * timestamp (every 120s).
   */
  private startTimestampUpdates(sessionId: string): void {
    this.stopTimestampUpdates();

    this.timestampInterval = setInterval(() => {
      void this.registrar.updateTimestamp(sessionId).catch((error) => {
        this.logger.error(
          `Failed to update timestamp for session ${sessionId}`,
          error instanceof Error ? error : new Error(String(error)),
        );
      });
    }, TIMESTAMP_UPDATE_INTERVAL_MS);

    this.logger.info(
      `Timestamp update interval started (every ${TIMESTAMP_UPDATE_INTERVAL_MS}ms)`,
    );
  }

  /**
   * Stop the periodic timestamp update interval.
   */
  private stopTimestampUpdates(): void {
    if (this.timestampInterval !== null) {
      clearInterval(this.timestampInterval);
      this.timestampInterval = null;
    }
  }

  // -----------------------------------------------------------------------
  // Private — Session rotation
  // -----------------------------------------------------------------------

  /**
   * Start periodic checks for session rotation (session age > 11 hours).
   * Checks at the session status interval (≤ 60s).
   */
  private startRotationCheck(): void {
    this.stopRotationCheck();

    this.rotationInterval = setInterval(() => {
      void this.checkRotation();
    }, SESSION_STATUS_INTERVAL_MS);
  }

  /**
   * Stop the periodic rotation check interval.
   */
  private stopRotationCheck(): void {
    if (this.rotationInterval !== null) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }
  }

  /**
   * Check if the active session should be rotated and perform rotation
   * if needed. Starts a new session before tearing down the old one.
   */
  private async checkRotation(): Promise<void> {
    if (this.isRotating || !this.activeSessionStartedAt) {
      return;
    }

    const startTimeMs = Date.parse(this.activeSessionStartedAt);
    const now = Date.now();

    if (!shouldRotateSession(startTimeMs, now)) {
      return;
    }

    this.isRotating = true;
    const oldSessionId = this.activeSessionId;

    this.logger.info(
      `Session ${oldSessionId} has exceeded 11-hour threshold, initiating rotation`,
    );

    try {
      // Stop monitoring and intervals for the old session
      this.healthMonitor.stop();
      this.stopTimestampUpdates();
      this.stopRotationCheck();

      // Start a new session (this sets activeSessionId to the new one)
      await this.startSession();

      // Tear down the old session
      if (oldSessionId) {
        this.logger.info(`Tearing down old session ${oldSessionId}`);
        try {
          await this.registrar.removeSession(oldSessionId);
        } catch (error) {
          this.logger.error(
            `Failed to remove old orchestrator record for ${oldSessionId}`,
            error instanceof Error ? error : new Error(String(error)),
          );
        }
        try {
          await this.provider.destroySession(oldSessionId);
        } catch (error) {
          this.logger.error(
            `Failed to destroy old session ${oldSessionId}`,
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }

      this.logger.info('Session rotation completed successfully');
    } catch (error) {
      this.logger.error(
        'Session rotation failed',
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      this.isRotating = false;
    }
  }
}
