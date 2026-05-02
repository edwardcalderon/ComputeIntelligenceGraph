/**
 * Health monitor that periodically checks two dimensions:
 * compute session status (via provider) and worker heartbeat
 * freshness (via registrar).
 *
 * Emits structured log entries for each health check with timestamp,
 * sessionId, check type, result, and latency.
 *
 * @module
 */

import type { ComputeProvider } from '../providers/types.js';
import type { SessionRegistrar } from '../state/session-registrar.js';
import type { Logger } from '../lib/logger.js';
import type {
  HealthCheckResult,
  SessionHealthResult,
  WorkerHeartbeatResult,
} from './recovery.js';

// ---------------------------------------------------------------------------
// Pure helper — exported for property testing
// ---------------------------------------------------------------------------

/**
 * Determine whether a heartbeat timestamp is fresh relative to a current
 * timestamp and a threshold in seconds.
 *
 * Returns `true` (healthy) if and only if the age of the heartbeat
 * (currentTimestamp − heartbeatTimestamp) is less than or equal to the
 * threshold.
 *
 * Both timestamps must be valid ISO 8601 strings.
 */
export function isHeartbeatFresh(
  heartbeatTimestamp: string,
  currentTimestamp: string,
  thresholdSeconds: number,
): boolean {
  const heartbeatMs = Date.parse(heartbeatTimestamp);
  const currentMs = Date.parse(currentTimestamp);
  const ageSeconds = (currentMs - heartbeatMs) / 1000;
  return ageSeconds <= thresholdSeconds;
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

/** Default heartbeat threshold in seconds (3 minutes). */
const DEFAULT_HEARTBEAT_THRESHOLD_SECONDS = 180;

// ---------------------------------------------------------------------------
// HealthMonitor
// ---------------------------------------------------------------------------

/**
 * Periodically checks two health dimensions for a compute session:
 *
 * 1. **Session status** — queries the compute provider for the session's
 *    current status. Healthy if status is `'connected'` or `'running'`.
 * 2. **Worker heartbeat** — reads the latest heartbeat from the session
 *    registrar. Healthy if the heartbeat age is within the configured
 *    threshold (default 180 s).
 *
 * Use {@link start} to begin periodic monitoring and {@link stop} to
 * cancel it.
 */
export class HealthMonitor {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly provider: ComputeProvider,
    private readonly registrar: SessionRegistrar,
    private readonly logger: Logger,
    private readonly intervalMs: number,
    private readonly heartbeatThresholdSeconds: number = DEFAULT_HEARTBEAT_THRESHOLD_SECONDS,
  ) {}

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Run all health checks for the given session and return a combined
   * {@link HealthCheckResult}.
   *
   * Each dimension is checked independently; a failure in one does not
   * prevent the other from being evaluated.
   */
  async checkAll(sessionId: string): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();

    // --- Session status check ---
    const sessionResult = await this.checkSession(sessionId);

    // --- Worker heartbeat check ---
    const heartbeatResult = await this.checkHeartbeat(timestamp);

    const overall = sessionResult.healthy && heartbeatResult.healthy;

    const result: HealthCheckResult = {
      timestamp,
      sessionId,
      checks: {
        session: sessionResult,
        workerHeartbeat: heartbeatResult,
      },
      overall,
    };

    this.logger.info(
      `Health check complete: overall=${overall}, session=${sessionResult.healthy} (${sessionResult.status}), heartbeat=${heartbeatResult.healthy}${heartbeatResult.ageSeconds !== undefined ? ` (age=${heartbeatResult.ageSeconds}s)` : ''}`,
    );

    return result;
  }

  /**
   * Start periodic health checks at the configured interval.
   *
   * Calls `onUnhealthy` whenever the overall health result is `false`.
   * If a monitoring loop is already running it is stopped first.
   */
  start(
    sessionId: string,
    onUnhealthy: (result: HealthCheckResult) => void,
  ): void {
    // Ensure we don't leak intervals
    this.stop();

    this.logger.info(
      `Starting health monitoring every ${this.intervalMs}ms (heartbeat threshold: ${this.heartbeatThresholdSeconds}s)`,
    );

    this.intervalHandle = setInterval(() => {
      void this.checkAll(sessionId).then((result) => {
        if (!result.overall) {
          onUnhealthy(result);
        }
      });
    }, this.intervalMs);
  }

  /**
   * Stop the periodic monitoring loop. Safe to call even if monitoring
   * has not been started.
   */
  stop(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      this.logger.info('Health monitoring stopped');
    }
  }

  // -----------------------------------------------------------------------
  // Private dimension checks
  // -----------------------------------------------------------------------

  /**
   * Check the compute session status via the provider.
   *
   * Healthy if the reported status is `'connected'` or `'running'`.
   */
  private async checkSession(
    sessionId: string,
  ): Promise<SessionHealthResult> {
    const start = Date.now();
    try {
      const info = await this.provider.getSessionStatus(sessionId);
      const latencyMs = Date.now() - start;
      const healthy =
        info.status === 'connected' || info.status === 'running';

      this.logger.debug(
        `Session check: status=${info.status}, healthy=${healthy}, latency=${latencyMs}ms`,
      );

      return { healthy, latencyMs, status: info.status };
    } catch (error) {
      const latencyMs = Date.now() - start;
      this.logger.error(
        `Session check failed: latency=${latencyMs}ms`,
        error instanceof Error ? error : new Error(String(error)),
      );
      return { healthy: false, latencyMs, status: 'error' };
    }
  }

  /**
   * Check the worker heartbeat freshness via the registrar.
   *
   * Healthy if a heartbeat exists and its age is within the configured
   * threshold.
   */
  private async checkHeartbeat(
    currentTimestamp: string,
  ): Promise<WorkerHeartbeatResult> {
    const start = Date.now();
    try {
      const heartbeat = await this.registrar.getWorkerHeartbeat();
      const latencyMs = Date.now() - start;

      if (!heartbeat) {
        this.logger.debug(
          `Heartbeat check: no heartbeat found, healthy=false, latency=${latencyMs}ms`,
        );
        return { healthy: false, latencyMs };
      }

      const heartbeatMs = Date.parse(heartbeat.lastHeartbeatAt);
      const currentMs = Date.parse(currentTimestamp);
      const ageSeconds = Math.round((currentMs - heartbeatMs) / 1000);

      const healthy = isHeartbeatFresh(
        heartbeat.lastHeartbeatAt,
        currentTimestamp,
        this.heartbeatThresholdSeconds,
      );

      this.logger.debug(
        `Heartbeat check: lastHeartbeatAt=${heartbeat.lastHeartbeatAt}, age=${ageSeconds}s, healthy=${healthy}, latency=${latencyMs}ms`,
      );

      return {
        healthy,
        latencyMs,
        lastHeartbeatAt: heartbeat.lastHeartbeatAt,
        ageSeconds,
      };
    } catch (error) {
      const latencyMs = Date.now() - start;
      this.logger.error(
        `Heartbeat check failed: latency=${latencyMs}ms`,
        error instanceof Error ? error : new Error(String(error)),
      );
      return { healthy: false, latencyMs };
    }
  }
}
