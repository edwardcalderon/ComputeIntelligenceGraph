/**
 * Local compute provider implementation.
 *
 * Implements the {@link ComputeProvider} interface for local GPU testing
 * without requiring any cloud credentials. Uses `node:child_process` to
 * manage a local Ollama server and worker script.
 *
 * This provider is intended for development and testing — it verifies that
 * Ollama is installed locally, starts the server if needed, pulls requested
 * models, and runs the worker script as a child process.
 *
 * @module
 */

import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { v4 as uuidv4 } from 'uuid';
import type { Logger } from '../lib/logger.js';
import { ProviderError } from '../lib/errors.js';
import type {
  ComputeProvider,
  SessionInfo,
  SessionCreateOptions,
  SessionStatus,
  CommandResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Internal session tracking
// ---------------------------------------------------------------------------

/** Internal record kept for each active local session. */
interface TrackedLocalSession {
  sessionId: string;
  status: SessionStatus;
  startedAt: string;
  startedAtMs: number;
  workerProcess: ChildProcess | null;
  ollamaStartedByUs: boolean;
  logs: string[];
}

// ---------------------------------------------------------------------------
// LocalProvider
// ---------------------------------------------------------------------------

/**
 * {@link ComputeProvider} implementation for local GPU testing.
 *
 * Lifecycle:
 * 1. `createSession` — verify Ollama is installed, start server if needed,
 *    pull requested models, start worker script as a child process.
 * 2. `destroySession` — kill the worker child process and optionally stop
 *    the Ollama server (only if we started it).
 * 3. `getSessionStatus` — check whether the worker child process is running.
 * 4. `executeCommand` — execute a shell command via `child_process`.
 * 5. `getSessionLogs` — return collected stdout/stderr from the worker.
 */
export class LocalProvider implements ComputeProvider {
  readonly providerName = 'local';

  /** Internal map of active sessions keyed by session ID. */
  private readonly sessions = new Map<string, TrackedLocalSession>();

  constructor(private readonly logger: Logger) {}

  // -----------------------------------------------------------------------
  // ComputeProvider — createSession
  // -----------------------------------------------------------------------

  async createSession(options: SessionCreateOptions): Promise<SessionInfo> {
    const sessionId = uuidv4();
    const now = new Date();

    this.logger.info(`Creating local session ${sessionId}`);

    // Track the session immediately (status: creating)
    const tracked: TrackedLocalSession = {
      sessionId,
      status: 'creating',
      startedAt: now.toISOString(),
      startedAtMs: now.getTime(),
      workerProcess: null,
      ollamaStartedByUs: false,
      logs: [],
    };
    this.sessions.set(sessionId, tracked);

    try {
      // 1. Verify Ollama is installed locally
      this.verifyOllamaInstalled(sessionId);

      // 2. Start Ollama server if not already running
      const started = await this.ensureOllamaRunning(sessionId);
      tracked.ollamaStartedByUs = started;

      // 3. Pull requested models
      for (const model of options.models) {
        this.pullModel(sessionId, model);
      }

      // 4. Start worker script as child process
      this.startWorkerProcess(sessionId, tracked, options);

      tracked.status = 'running';
      this.logger.info(`Local session ${sessionId} is running`);
    } catch (err) {
      tracked.status = 'error';
      const message = err instanceof Error ? err.message : String(err);
      tracked.logs.push(`Session creation failed: ${message}`);
      this.logger.error(`Failed to create local session ${sessionId}: ${message}`);

      // Clean up on failure
      this.cleanupWorkerProcess(tracked);

      throw err instanceof ProviderError
        ? err
        : new ProviderError(
            `Local session creation failed: ${message}`,
            {
              component: 'LocalProvider',
              sessionId,
              operation: 'createSession',
            },
          );
    }

    return this.buildSessionInfo(tracked);
  }

  // -----------------------------------------------------------------------
  // ComputeProvider — destroySession
  // -----------------------------------------------------------------------

  async destroySession(sessionId: string): Promise<void> {
    const tracked = this.sessions.get(sessionId);
    if (!tracked) {
      throw new ProviderError(`Session not found: ${sessionId}`, {
        component: 'LocalProvider',
        sessionId,
        operation: 'destroySession',
      });
    }

    this.logger.info(`Destroying local session ${sessionId}`);

    // 1. Stop worker child process
    this.cleanupWorkerProcess(tracked);

    // 2. Stop Ollama server if we started it
    if (tracked.ollamaStartedByUs) {
      this.stopOllamaServer(sessionId);
    }

    // 3. Clean up internal tracking
    tracked.status = 'terminated';
    this.sessions.delete(sessionId);

    this.logger.info(`Local session ${sessionId} destroyed`);
  }

  // -----------------------------------------------------------------------
  // ComputeProvider — getSessionStatus
  // -----------------------------------------------------------------------

  async getSessionStatus(sessionId: string): Promise<SessionInfo> {
    const tracked = this.sessions.get(sessionId);
    if (!tracked) {
      throw new ProviderError(`Session not found: ${sessionId}`, {
        component: 'LocalProvider',
        sessionId,
        operation: 'getSessionStatus',
      });
    }

    // Update status based on whether the worker process is still alive
    if (
      tracked.status === 'running' &&
      tracked.workerProcess !== null &&
      tracked.workerProcess.exitCode !== null
    ) {
      tracked.status = 'disconnected';
      tracked.logs.push(
        `Worker process exited with code ${tracked.workerProcess.exitCode}`,
      );
    }

    return this.buildSessionInfo(tracked);
  }

  // -----------------------------------------------------------------------
  // ComputeProvider — executeCommand
  // -----------------------------------------------------------------------

  async executeCommand(
    sessionId: string,
    command: string,
  ): Promise<CommandResult> {
    const tracked = this.sessions.get(sessionId);
    if (!tracked) {
      throw new ProviderError(`Session not found: ${sessionId}`, {
        component: 'LocalProvider',
        sessionId,
        operation: 'executeCommand',
      });
    }

    this.logger.debug(
      `Executing command in local session ${sessionId}: ${command.slice(0, 100)}`,
    );

    try {
      const stdout = execSync(command, {
        encoding: 'utf-8',
        timeout: 60_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const result: CommandResult = {
        exitCode: 0,
        stdout,
        stderr: '',
      };

      tracked.logs.push(`$ ${command}\n${stdout}`);
      return result;
    } catch (err: unknown) {
      const execError = err as {
        status?: number;
        stdout?: string;
        stderr?: string;
        message?: string;
      };

      const result: CommandResult = {
        exitCode: execError.status ?? 1,
        stdout: typeof execError.stdout === 'string' ? execError.stdout : '',
        stderr: typeof execError.stderr === 'string' ? execError.stderr : '',
      };

      tracked.logs.push(
        `$ ${command}\n${result.stdout}${result.stderr}`,
      );
      return result;
    }
  }

  // -----------------------------------------------------------------------
  // ComputeProvider — getSessionLogs
  // -----------------------------------------------------------------------

  async getSessionLogs(
    sessionId: string,
    lines?: number,
  ): Promise<string> {
    const tracked = this.sessions.get(sessionId);
    if (!tracked) {
      throw new ProviderError(`Session not found: ${sessionId}`, {
        component: 'LocalProvider',
        sessionId,
        operation: 'getSessionLogs',
      });
    }

    const allLogs = tracked.logs.join('\n');
    if (lines === undefined) {
      return allLogs;
    }

    const logLines = allLogs.split('\n');
    return logLines.slice(-lines).join('\n');
  }

  // -----------------------------------------------------------------------
  // Internal — Ollama management
  // -----------------------------------------------------------------------

  /**
   * Verify that the `ollama` binary is available on the PATH.
   */
  private verifyOllamaInstalled(sessionId: string): void {
    this.logger.debug(`Verifying Ollama is installed for session ${sessionId}`);

    try {
      const version = execSync('ollama --version', {
        encoding: 'utf-8',
        timeout: 10_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      this.logger.info(`Ollama found: ${version}`);
    } catch {
      throw new ProviderError(
        'Ollama is not installed or not on PATH. Install from https://ollama.com',
        {
          component: 'LocalProvider',
          sessionId,
          operation: 'verifyOllamaInstalled',
        },
      );
    }
  }

  /**
   * Ensure the Ollama server is running on localhost:11434.
   *
   * @returns `true` if we started the server, `false` if it was already running.
   */
  private async ensureOllamaRunning(sessionId: string): Promise<boolean> {
    // Check if Ollama is already serving
    if (this.isOllamaServing()) {
      this.logger.info('Ollama server is already running');
      return false;
    }

    this.logger.info(`Starting Ollama server for session ${sessionId}`);

    // Start Ollama serve in the background
    const ollamaProcess = spawn('ollama', ['serve'], {
      stdio: 'ignore',
      detached: true,
    });
    ollamaProcess.unref();

    // Wait for the server to become responsive (up to 30 seconds)
    const maxWaitMs = 30_000;
    const pollIntervalMs = 1_000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      await this.sleep(pollIntervalMs);
      if (this.isOllamaServing()) {
        this.logger.info('Ollama server started successfully');
        return true;
      }
    }

    throw new ProviderError(
      'Ollama server failed to start within 30 seconds',
      {
        component: 'LocalProvider',
        sessionId,
        operation: 'ensureOllamaRunning',
      },
    );
  }

  /**
   * Check whether the Ollama server is responding on localhost:11434.
   */
  private isOllamaServing(): boolean {
    try {
      execSync('curl -sf http://localhost:11434/', {
        encoding: 'utf-8',
        timeout: 5_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Pull a model using `ollama pull`.
   */
  private pullModel(sessionId: string, model: string): void {
    this.logger.info(`Pulling model "${model}" for session ${sessionId}`);

    try {
      const output = execSync(`ollama pull ${model}`, {
        encoding: 'utf-8',
        timeout: 600_000, // 10 minute timeout for large models
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.logger.info(`Model "${model}" pulled successfully`);
      const tracked = this.sessions.get(sessionId);
      if (tracked) {
        tracked.logs.push(`Pulled model: ${model}\n${output}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ProviderError(
        `Failed to pull model "${model}": ${message}`,
        {
          component: 'LocalProvider',
          sessionId,
          operation: 'pullModel',
        },
      );
    }
  }

  /**
   * Stop the Ollama server process.
   */
  private stopOllamaServer(sessionId: string): void {
    this.logger.info(`Stopping Ollama server for session ${sessionId}`);

    try {
      execSync('ollama stop', {
        encoding: 'utf-8',
        timeout: 10_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.logger.info('Ollama server stopped');
    } catch {
      this.logger.warn(
        `Failed to stop Ollama server for session ${sessionId} — it may still be running`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Internal — Worker process management
  // -----------------------------------------------------------------------

  /**
   * Start the worker script as a child process.
   *
   * Extracts the worker script content from the notebook's last code cell
   * and runs it with Python, passing AWS configuration via environment
   * variables.
   */
  private startWorkerProcess(
    sessionId: string,
    tracked: TrackedLocalSession,
    options: SessionCreateOptions,
  ): void {
    this.logger.info(`Starting worker process for session ${sessionId}`);

    // Extract worker script from the last code cell of the notebook
    const codeCells = options.notebook.cells.filter(
      (c) => c.cell_type === 'code',
    );
    const lastCell = codeCells[codeCells.length - 1];

    if (!lastCell) {
      throw new ProviderError(
        'Notebook contains no code cells — cannot extract worker script',
        {
          component: 'LocalProvider',
          sessionId,
          operation: 'startWorkerProcess',
        },
      );
    }

    // The worker cell source contains the Python script
    const workerSource = lastCell.source.join('');

    const workerProcess = spawn('python3', ['-c', workerSource], {
      env: {
        ...process.env,
        AWS_DEFAULT_REGION: options.awsConfig.region,
        OLLAMA_HOST: 'http://localhost:11434',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    tracked.workerProcess = workerProcess;

    // Collect stdout
    workerProcess.stdout?.on('data', (data: Buffer) => {
      const line = data.toString();
      tracked.logs.push(line);
      this.logger.debug(`[worker:${sessionId}] ${line.trim()}`);
    });

    // Collect stderr
    workerProcess.stderr?.on('data', (data: Buffer) => {
      const line = data.toString();
      tracked.logs.push(line);
      this.logger.debug(`[worker:${sessionId}:stderr] ${line.trim()}`);
    });

    workerProcess.on('exit', (code) => {
      this.logger.info(
        `Worker process for session ${sessionId} exited with code ${code}`,
      );
      tracked.logs.push(`Worker process exited with code ${code}`);
    });

    workerProcess.on('error', (err) => {
      this.logger.error(
        `Worker process error for session ${sessionId}: ${err.message}`,
      );
      tracked.logs.push(`Worker process error: ${err.message}`);
    });

    this.logger.info(
      `Worker process started for session ${sessionId} (pid: ${workerProcess.pid})`,
    );
  }

  /**
   * Kill the worker child process if it is still running.
   */
  private cleanupWorkerProcess(tracked: TrackedLocalSession): void {
    if (tracked.workerProcess && tracked.workerProcess.exitCode === null) {
      this.logger.info(
        `Killing worker process for session ${tracked.sessionId} (pid: ${tracked.workerProcess.pid})`,
      );
      tracked.workerProcess.kill('SIGTERM');

      // Give it a moment, then force kill if still alive
      setTimeout(() => {
        if (
          tracked.workerProcess &&
          tracked.workerProcess.exitCode === null
        ) {
          tracked.workerProcess.kill('SIGKILL');
        }
      }, 5_000);
    }
  }

  // -----------------------------------------------------------------------
  // Internal — helpers
  // -----------------------------------------------------------------------

  /**
   * Build a {@link SessionInfo} from an internal tracked session.
   */
  private buildSessionInfo(tracked: TrackedLocalSession): SessionInfo {
    return {
      sessionId: tracked.sessionId,
      status: tracked.status,
      provider: this.providerName,
      startedAt: tracked.startedAt,
      metadata: {
        workerPid: tracked.workerProcess?.pid?.toString() ?? '',
        ollamaStartedByUs: String(tracked.ollamaStartedByUs),
      },
    };
  }

  /**
   * Sleep for the given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
