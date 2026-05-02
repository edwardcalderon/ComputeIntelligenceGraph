/**
 * Provider-agnostic compute abstraction types.
 *
 * All compute backends (Google Colab, Kaggle, local GPU, etc.) implement the
 * {@link ComputeProvider} interface so the rest of the orchestrator is
 * decoupled from any specific provider.
 *
 * @module
 */

import type { NotebookDocument } from '../notebook/types.js';

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

/**
 * Reference to AWS credentials resolved through the standard AWS credential
 * chain (environment variables, shared credentials file, or IAM role).
 *
 * **No explicit access keys are stored here** — the worker and orchestrator
 * rely on the ambient credential chain at runtime.
 */
export interface AWSCredentialRef {
  /** AWS region for the target resources (SQS, DynamoDB). */
  region: string;
  // Uses standard AWS credential chain — no explicit keys
}

/** Status values a compute session can be in. */
export type SessionStatus =
  | 'creating'
  | 'connected'
  | 'running'
  | 'disconnected'
  | 'error'
  | 'terminated';

/** Snapshot of a compute session's current state. */
export interface SessionInfo {
  /** Provider-independent session identifier (opaque string). */
  sessionId: string;
  /** Current lifecycle status of the session. */
  status: SessionStatus;
  /** Name of the provider that owns this session (e.g. `"colab"`, `"local"`). */
  provider: string;
  /** ISO 8601 timestamp of when the session was created. */
  startedAt: string;
  /** Provider-specific metadata (e.g. Google Drive `fileId` for Colab). */
  metadata: Record<string, string>;
}

/** Options passed to {@link ComputeProvider.createSession}. */
export interface SessionCreateOptions {
  /** Generated Jupyter notebook to upload / execute in the session. */
  notebook: NotebookDocument;
  /** Ollama model names to pull inside the session. */
  models: string[];
  /** AWS credential reference (resolved via the standard credential chain). */
  awsConfig: AWSCredentialRef;
}

/** Result of running a shell command inside a compute session. */
export interface CommandResult {
  /** Process exit code (`0` = success). */
  exitCode: number;
  /** Standard output captured from the command. */
  stdout: string;
  /** Standard error captured from the command. */
  stderr: string;
}

// ---------------------------------------------------------------------------
// Core provider interface
// ---------------------------------------------------------------------------

/**
 * Provider-agnostic interface for managing remote (or local) GPU compute
 * sessions.
 *
 * Implementations must be stateless with respect to the orchestrator — all
 * session state is tracked via the returned {@link SessionInfo} and the
 * provider's own backend.
 */
export interface ComputeProvider {
  /** Human-readable provider name (e.g. `"colab"`, `"local"`). */
  readonly providerName: string;

  /**
   * Create a new compute session, upload the notebook, and start execution.
   *
   * @returns Session information including the provider-independent session ID.
   */
  createSession(options: SessionCreateOptions): Promise<SessionInfo>;

  /**
   * Tear down a compute session and clean up associated resources
   * (e.g. delete the Drive notebook, disconnect the Colab runtime).
   */
  destroySession(sessionId: string): Promise<void>;

  /**
   * Query the current status of an existing session.
   */
  getSessionStatus(sessionId: string): Promise<SessionInfo>;

  /**
   * Execute a shell command inside the compute session.
   *
   * @returns The command's exit code, stdout, and stderr.
   */
  executeCommand(sessionId: string, command: string): Promise<CommandResult>;

  /**
   * Retrieve recent log output from the compute session.
   *
   * @param lines - Optional maximum number of log lines to return.
   */
  getSessionLogs(sessionId: string, lines?: number): Promise<string>;
}
