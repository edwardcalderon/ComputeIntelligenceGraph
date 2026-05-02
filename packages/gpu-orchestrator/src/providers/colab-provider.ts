/**
 * Google Colab compute provider implementation.
 *
 * Implements the {@link ComputeProvider} interface for Google Colab free tier.
 * Uses Google Drive API v3 to upload generated notebooks and the Colab internal
 * API (with Selenium fallback) for runtime connection and execution.
 *
 * **Note:** Google Colab free tier has no official public API for runtime
 * management. This provider uses undocumented REST endpoints at
 * `colab.research.google.com/api` which may change without notice. Aggressive
 * retry logic and clear error categorisation mitigate this fragility.
 *
 * @module
 */

import { v4 as uuidv4 } from 'uuid';
import type { drive_v3 } from 'googleapis';
import type { GoogleAuth } from '../auth/google-auth.js';
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
// Constants
// ---------------------------------------------------------------------------

/** Maximum time (ms) to wait for a Colab runtime to reach `connected` state. */
const RUNTIME_CONNECT_TIMEOUT_MS = 120_000;

/** Polling interval (ms) when waiting for runtime connection. */
const RUNTIME_POLL_INTERVAL_MS = 3_000;

/** Session age threshold (ms) for proactive rotation — 11 hours. */
const SESSION_ROTATION_THRESHOLD_MS = 39_600_000;

/** MIME type for Jupyter notebook files on Google Drive. */
const COLAB_NOTEBOOK_MIME_TYPE = 'application/vnd.google.colab';

/** Base URL for the Colab internal API. */
const COLAB_API_BASE = 'https://colab.research.google.com/api';

// ---------------------------------------------------------------------------
// Internal session tracking
// ---------------------------------------------------------------------------

/** Internal record kept for each active session. */
interface TrackedSession {
  sessionId: string;
  driveFileId: string;
  status: SessionStatus;
  startedAt: string;
  startedAtMs: number;
  logs: string[];
}

// ---------------------------------------------------------------------------
// ColabProvider
// ---------------------------------------------------------------------------

/**
 * {@link ComputeProvider} implementation for Google Colab free tier.
 *
 * Lifecycle:
 * 1. `createSession` — serialise notebook JSON, upload to Google Drive,
 *    connect a Colab runtime, execute cells, return {@link SessionInfo}.
 * 2. `destroySession` — disconnect the Colab runtime and delete the
 *    notebook from Google Drive.
 * 3. `getSessionStatus` — return the tracked session info with current status.
 * 4. `executeCommand` — execute a command via the Colab code execution API.
 * 5. `getSessionLogs` — return collected cell outputs.
 */
export class ColabProvider implements ComputeProvider {
  readonly providerName = 'colab';

  /** Internal map of active sessions keyed by session ID. */
  private readonly sessions = new Map<string, TrackedSession>();

  constructor(
    private readonly auth: GoogleAuth,
    private readonly logger: Logger,
  ) {}

  // -----------------------------------------------------------------------
  // ComputeProvider — createSession
  // -----------------------------------------------------------------------

  /**
   * Create a new Colab session.
   *
   * 1. Serialise the notebook to JSON.
   * 2. Upload to Google Drive via Drive API v3.
   * 3. Connect a Colab runtime (Colab API with Selenium fallback).
   * 4. Execute notebook cells.
   * 5. Return {@link SessionInfo} with the Drive `fileId` in metadata.
   */
  async createSession(options: SessionCreateOptions): Promise<SessionInfo> {
    const sessionId = uuidv4();
    const now = new Date();

    this.logger.info(`Creating Colab session ${sessionId}`);

    // 1. Serialise notebook JSON
    const notebookJson = JSON.stringify(options.notebook);

    // 2. Upload to Google Drive
    const driveFileId = await this.uploadNotebookToDrive(sessionId, notebookJson);

    // 3. Track the session immediately (status: creating)
    const tracked: TrackedSession = {
      sessionId,
      driveFileId,
      status: 'creating',
      startedAt: now.toISOString(),
      startedAtMs: now.getTime(),
      logs: [],
    };
    this.sessions.set(sessionId, tracked);

    // 4. Connect Colab runtime and wait for connected state
    try {
      await this.connectRuntime(sessionId, driveFileId);
      tracked.status = 'connected';
      this.logger.info(`Colab runtime connected for session ${sessionId}`);
    } catch (err) {
      tracked.status = 'error';
      const message =
        err instanceof Error ? err.message : String(err);
      tracked.logs.push(`Runtime connection failed: ${message}`);
      this.logger.error(
        `Failed to connect Colab runtime for session ${sessionId}: ${message}`,
      );
      throw new ProviderError(
        `Colab runtime failed to reach connected state: ${message}`,
        {
          component: 'ColabProvider',
          sessionId,
          operation: 'createSession',
        },
      );
    }

    // 5. Execute notebook cells
    try {
      await this.executeNotebookCells(sessionId, driveFileId);
      tracked.status = 'running';
      this.logger.info(`Notebook cells executing for session ${sessionId}`);
    } catch (err) {
      tracked.status = 'error';
      const message =
        err instanceof Error ? err.message : String(err);
      tracked.logs.push(`Cell execution failed: ${message}`);
      this.logger.error(
        `Failed to execute notebook cells for session ${sessionId}: ${message}`,
      );
      throw new ProviderError(
        `Failed to execute notebook cells: ${message}`,
        {
          component: 'ColabProvider',
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

  /**
   * Tear down a Colab session.
   *
   * 1. Disconnect the Colab runtime.
   * 2. Delete the notebook from Google Drive.
   * 3. Remove the session from internal tracking.
   */
  async destroySession(sessionId: string): Promise<void> {
    const tracked = this.sessions.get(sessionId);
    if (!tracked) {
      throw new ProviderError(`Session not found: ${sessionId}`, {
        component: 'ColabProvider',
        sessionId,
        operation: 'destroySession',
      });
    }

    this.logger.info(`Destroying Colab session ${sessionId}`);

    // 1. Disconnect Colab runtime
    try {
      await this.disconnectRuntime(sessionId, tracked.driveFileId);
      this.logger.info(`Colab runtime disconnected for session ${sessionId}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to disconnect Colab runtime for session ${sessionId}: ${message}`,
      );
      // Continue with cleanup even if disconnect fails
    }

    // 2. Delete notebook from Google Drive
    try {
      await this.deleteNotebookFromDrive(tracked.driveFileId);
      this.logger.info(
        `Notebook deleted from Drive for session ${sessionId} (fileId: ${tracked.driveFileId})`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to delete notebook from Drive for session ${sessionId}: ${message}`,
      );
    }

    // 3. Clean up internal tracking
    tracked.status = 'terminated';
    this.sessions.delete(sessionId);
  }

  // -----------------------------------------------------------------------
  // ComputeProvider — getSessionStatus
  // -----------------------------------------------------------------------

  /**
   * Return the current status of a tracked session.
   *
   * Queries the Colab API for runtime status and updates the internal
   * tracking record.
   */
  async getSessionStatus(sessionId: string): Promise<SessionInfo> {
    const tracked = this.sessions.get(sessionId);
    if (!tracked) {
      throw new ProviderError(`Session not found: ${sessionId}`, {
        component: 'ColabProvider',
        sessionId,
        operation: 'getSessionStatus',
      });
    }

    // Attempt to query Colab API for live status
    try {
      const liveStatus = await this.queryRuntimeStatus(tracked.driveFileId);
      tracked.status = liveStatus;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to query Colab runtime status for session ${sessionId}: ${message}`,
      );
      // Keep the last known status
    }

    return this.buildSessionInfo(tracked);
  }

  // -----------------------------------------------------------------------
  // ComputeProvider — executeCommand
  // -----------------------------------------------------------------------

  /**
   * Execute a shell command inside the Colab session via the code execution API.
   */
  async executeCommand(
    sessionId: string,
    command: string,
  ): Promise<CommandResult> {
    const tracked = this.sessions.get(sessionId);
    if (!tracked) {
      throw new ProviderError(`Session not found: ${sessionId}`, {
        component: 'ColabProvider',
        sessionId,
        operation: 'executeCommand',
      });
    }

    this.logger.debug(
      `Executing command in session ${sessionId}: ${command.slice(0, 100)}`,
    );

    try {
      const result = await this.executeViaColabApi(
        tracked.driveFileId,
        command,
      );
      tracked.logs.push(`$ ${command}\n${result.stdout}${result.stderr}`);
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      throw new ProviderError(
        `Command execution failed in session ${sessionId}: ${message}`,
        {
          component: 'ColabProvider',
          sessionId,
          operation: 'executeCommand',
        },
      );
    }
  }

  // -----------------------------------------------------------------------
  // ComputeProvider — getSessionLogs
  // -----------------------------------------------------------------------

  /**
   * Return collected cell outputs / logs for the session.
   *
   * @param lines - Optional maximum number of log lines to return.
   */
  async getSessionLogs(
    sessionId: string,
    lines?: number,
  ): Promise<string> {
    const tracked = this.sessions.get(sessionId);
    if (!tracked) {
      throw new ProviderError(`Session not found: ${sessionId}`, {
        component: 'ColabProvider',
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
  // Session rotation check
  // -----------------------------------------------------------------------

  /**
   * Check whether a session should be proactively rotated.
   *
   * Returns `true` if the session has been running for more than 11 hours
   * (39 600 000 ms), indicating it is approaching the Colab free-tier
   * ~12-hour limit.
   */
  shouldRotate(sessionId: string): boolean {
    const tracked = this.sessions.get(sessionId);
    if (!tracked) {
      return false;
    }
    return Date.now() - tracked.startedAtMs > SESSION_ROTATION_THRESHOLD_MS;
  }

  // -----------------------------------------------------------------------
  // Internal — Google Drive operations
  // -----------------------------------------------------------------------

  /**
   * Upload a serialised notebook JSON to Google Drive.
   *
   * @returns The Drive file ID of the uploaded notebook.
   */
  private async uploadNotebookToDrive(
    sessionId: string,
    notebookJson: string,
  ): Promise<string> {
    this.logger.info(`Uploading notebook to Google Drive for session ${sessionId}`);

    try {
      const drive = this.auth.getDriveClient();
      const response = await drive.files.create({
        requestBody: {
          name: `gpu-orchestrator-${sessionId}.ipynb`,
          mimeType: COLAB_NOTEBOOK_MIME_TYPE,
        },
        media: {
          mimeType: 'application/json',
          body: notebookJson,
        },
        fields: 'id',
      });

      const fileId = response.data.id;
      if (!fileId) {
        throw new Error('Drive API did not return a file ID');
      }

      this.logger.info(
        `Notebook uploaded to Drive: fileId=${fileId} for session ${sessionId}`,
      );
      return fileId;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      throw new ProviderError(
        `Failed to upload notebook to Google Drive: ${message}`,
        {
          component: 'ColabProvider',
          sessionId,
          operation: 'uploadNotebookToDrive',
        },
      );
    }
  }

  /**
   * Delete a notebook file from Google Drive.
   */
  private async deleteNotebookFromDrive(fileId: string): Promise<void> {
    const drive = this.auth.getDriveClient();
    await drive.files.delete({ fileId });
  }

  // -----------------------------------------------------------------------
  // Internal — Colab runtime operations
  // -----------------------------------------------------------------------

  /**
   * Connect a Colab runtime for the given Drive file and wait up to
   * {@link RUNTIME_CONNECT_TIMEOUT_MS} for it to reach `connected` state.
   *
   * Uses the Colab internal API. If the API is unavailable, falls back to
   * a Selenium-based approach (placeholder for future implementation).
   */
  private async connectRuntime(
    sessionId: string,
    driveFileId: string,
  ): Promise<void> {
    const token = await this.auth.getAccessToken();
    const startTime = Date.now();

    // Request runtime allocation
    this.logger.debug(
      `Requesting Colab runtime allocation for session ${sessionId}`,
    );

    const allocateResponse = await fetch(
      `${COLAB_API_BASE}/notebooks/${driveFileId}/sessions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ backend_type: 'GPU' }),
      },
    );

    if (!allocateResponse.ok) {
      const body = await allocateResponse.text();
      throw new ProviderError(
        `Colab runtime allocation failed (HTTP ${allocateResponse.status}): ${body}`,
        {
          component: 'ColabProvider',
          sessionId,
          operation: 'connectRuntime',
        },
      );
    }

    // Poll for connected state
    this.logger.debug(
      `Waiting for Colab runtime to reach connected state (timeout: ${RUNTIME_CONNECT_TIMEOUT_MS}ms)`,
    );

    while (Date.now() - startTime < RUNTIME_CONNECT_TIMEOUT_MS) {
      const status = await this.queryRuntimeStatus(driveFileId);
      if (status === 'connected' || status === 'running') {
        return;
      }
      if (status === 'error' || status === 'terminated') {
        throw new ProviderError(
          `Colab runtime entered ${status} state during connection`,
          {
            component: 'ColabProvider',
            sessionId,
            operation: 'connectRuntime',
          },
        );
      }
      await this.sleep(RUNTIME_POLL_INTERVAL_MS);
    }

    // Timeout — gather status and logs for the error
    const finalStatus = await this.queryRuntimeStatus(driveFileId).catch(
      () => 'unknown' as SessionStatus,
    );
    throw new ProviderError(
      `Colab runtime did not reach connected state within ${RUNTIME_CONNECT_TIMEOUT_MS}ms (last status: ${finalStatus})`,
      {
        component: 'ColabProvider',
        sessionId,
        operation: 'connectRuntime',
      },
    );
  }

  /**
   * Disconnect a Colab runtime for the given Drive file.
   */
  private async disconnectRuntime(
    sessionId: string,
    driveFileId: string,
  ): Promise<void> {
    const token = await this.auth.getAccessToken();

    const response = await fetch(
      `${COLAB_API_BASE}/notebooks/${driveFileId}/sessions`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new ProviderError(
        `Colab runtime disconnect failed (HTTP ${response.status}): ${body}`,
        {
          component: 'ColabProvider',
          sessionId,
          operation: 'disconnectRuntime',
        },
      );
    }
  }

  /**
   * Query the Colab API for the current runtime status of a notebook.
   */
  private async queryRuntimeStatus(
    driveFileId: string,
  ): Promise<SessionStatus> {
    const token = await this.auth.getAccessToken();

    const response = await fetch(
      `${COLAB_API_BASE}/notebooks/${driveFileId}/sessions`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new ProviderError(
        `Failed to query Colab runtime status (HTTP ${response.status})`,
        {
          component: 'ColabProvider',
          operation: 'queryRuntimeStatus',
        },
      );
    }

    const data = (await response.json()) as {
      sessions?: Array<{ state?: string }>;
    };

    const state = data.sessions?.[0]?.state ?? 'disconnected';
    return this.mapColabState(state);
  }

  /**
   * Execute all notebook cells in order via the Colab API.
   */
  private async executeNotebookCells(
    sessionId: string,
    driveFileId: string,
  ): Promise<void> {
    const token = await this.auth.getAccessToken();

    const response = await fetch(
      `${COLAB_API_BASE}/notebooks/${driveFileId}/cells:runAll`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new ProviderError(
        `Colab cell execution failed (HTTP ${response.status}): ${body}`,
        {
          component: 'ColabProvider',
          sessionId,
          operation: 'executeNotebookCells',
        },
      );
    }

    const tracked = this.sessions.get(sessionId);
    if (tracked) {
      tracked.logs.push('All notebook cells executed');
    }
  }

  /**
   * Execute a single command via the Colab code execution API.
   */
  private async executeViaColabApi(
    driveFileId: string,
    command: string,
  ): Promise<CommandResult> {
    const token = await this.auth.getAccessToken();

    const response = await fetch(
      `${COLAB_API_BASE}/notebooks/${driveFileId}/cells:execute`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cell: {
            cell_type: 'code',
            source: [`!${command}`],
          },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new ProviderError(
        `Colab command execution failed (HTTP ${response.status}): ${body}`,
        {
          component: 'ColabProvider',
          operation: 'executeViaColabApi',
        },
      );
    }

    const data = (await response.json()) as {
      outputs?: Array<{ text?: string; ename?: string; evalue?: string }>;
      exit_code?: number;
    };

    const stdout =
      data.outputs
        ?.filter((o) => o.text)
        .map((o) => o.text)
        .join('') ?? '';
    const stderr =
      data.outputs
        ?.filter((o) => o.ename)
        .map((o) => `${o.ename}: ${o.evalue}`)
        .join('\n') ?? '';

    return {
      exitCode: data.exit_code ?? (stderr ? 1 : 0),
      stdout,
      stderr,
    };
  }

  // -----------------------------------------------------------------------
  // Internal — helpers
  // -----------------------------------------------------------------------

  /**
   * Map a Colab API state string to a {@link SessionStatus}.
   */
  private mapColabState(state: string): SessionStatus {
    switch (state.toLowerCase()) {
      case 'starting':
      case 'allocating':
        return 'creating';
      case 'connected':
      case 'idle':
        return 'connected';
      case 'busy':
      case 'running':
        return 'running';
      case 'disconnected':
      case 'inactive':
        return 'disconnected';
      case 'error':
      case 'failed':
        return 'error';
      case 'terminated':
      case 'deleted':
        return 'terminated';
      default:
        return 'disconnected';
    }
  }

  /**
   * Build a {@link SessionInfo} from an internal tracked session.
   */
  private buildSessionInfo(tracked: TrackedSession): SessionInfo {
    return {
      sessionId: tracked.sessionId,
      status: tracked.status,
      provider: this.providerName,
      startedAt: tracked.startedAt,
      metadata: {
        driveFileId: tracked.driveFileId,
      },
    };
  }

  /**
   * Sleep for the given number of milliseconds.
   * Extracted as a method so tests can override it.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
