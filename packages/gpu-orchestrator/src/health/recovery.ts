/**
 * Recovery strategy for automated failure recovery with exponential backoff.
 *
 * Determines the appropriate recovery action based on health check results
 * and consecutive failure count, and calculates backoff delays between
 * recovery attempts.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Health check types (used by both HealthMonitor and RecoveryStrategy)
// ---------------------------------------------------------------------------

/** Result of a single health dimension check. */
export interface HealthDimensionResult {
  /** Whether this dimension is healthy. */
  healthy: boolean;
  /** Time taken to perform the check, in milliseconds. */
  latencyMs: number;
}

/** Session health dimension result. */
export interface SessionHealthResult extends HealthDimensionResult {
  /** Provider-reported session status string. */
  status: string;
}

/** Worker heartbeat health dimension result. */
export interface WorkerHeartbeatResult extends HealthDimensionResult {
  /** ISO 8601 timestamp of the last heartbeat, if available. */
  lastHeartbeatAt?: string;
  /** Age of the last heartbeat in seconds, if available. */
  ageSeconds?: number;
}

/** Combined result of all health checks for a session. */
export interface HealthCheckResult {
  /** ISO 8601 timestamp of when the check was performed. */
  timestamp: string;
  /** Session identifier that was checked. */
  sessionId: string;
  /** Individual dimension results. */
  checks: {
    session: SessionHealthResult;
    workerHeartbeat: WorkerHeartbeatResult;
  };
  /** `true` if and only if all dimensions are healthy. */
  overall: boolean;
}

// ---------------------------------------------------------------------------
// Recovery types
// ---------------------------------------------------------------------------

/** Configuration for the recovery strategy. */
export interface RecoveryConfig {
  /** Initial backoff delay in milliseconds. Default: 30_000 (30s). */
  initialBackoffMs: number;
  /** Maximum backoff delay in milliseconds. Default: 900_000 (15 min). */
  maxBackoffMs: number;
  /** Number of consecutive failures before entering dormant state. Default: 5. */
  maxConsecutiveFailures: number;
  /** Retry interval in dormant state, in milliseconds. Default: 1_800_000 (30 min). */
  dormantRetryMs: number;
}

/** Recovery action to take in response to a health check failure. */
export type RecoveryAction =
  | { type: 'restart_worker' }
  | { type: 'recreate_session' }
  | { type: 'enter_dormant' };

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  initialBackoffMs: 30_000,
  maxBackoffMs: 900_000,
  maxConsecutiveFailures: 5,
  dormantRetryMs: 1_800_000,
};

// ---------------------------------------------------------------------------
// RecoveryStrategy
// ---------------------------------------------------------------------------

/**
 * Determines recovery actions and calculates backoff delays for automated
 * failure recovery.
 *
 * Decision logic (evaluated in order):
 * 1. If `consecutiveFailures >= maxConsecutiveFailures` → `enter_dormant`
 * 2. If the session dimension is unhealthy → `recreate_session`
 * 3. If only the heartbeat dimension is unhealthy (session healthy) → `restart_worker`
 */
export class RecoveryStrategy {
  private readonly config: RecoveryConfig;

  constructor(config: Partial<RecoveryConfig> = {}) {
    this.config = { ...DEFAULT_RECOVERY_CONFIG, ...config };
  }

  /**
   * Determine the appropriate recovery action based on the health check
   * result and the number of consecutive failures so far.
   *
   * @param healthResult - The most recent health check result.
   * @param consecutiveFailures - Number of consecutive recovery failures.
   * @returns The recovery action to execute.
   */
  determineAction(
    healthResult: HealthCheckResult,
    consecutiveFailures: number,
  ): RecoveryAction {
    // Rule 1: Too many consecutive failures → enter dormant state
    if (consecutiveFailures >= this.config.maxConsecutiveFailures) {
      return { type: 'enter_dormant' };
    }

    // Rule 2: Session unhealthy (regardless of heartbeat) → recreate session
    if (!healthResult.checks.session.healthy) {
      return { type: 'recreate_session' };
    }

    // Rule 3: Only heartbeat unhealthy (session is healthy) → restart worker
    return { type: 'restart_worker' };
  }

  /**
   * Calculate the backoff delay for a given recovery attempt number.
   *
   * Uses exponential backoff: `min(initialBackoffMs × 2^attempt, maxBackoffMs)`.
   *
   * @param attempt - Zero-based attempt number.
   * @returns Backoff delay in milliseconds.
   */
  calculateBackoff(attempt: number): number {
    const backoff = this.config.initialBackoffMs * Math.pow(2, attempt);
    return Math.min(backoff, this.config.maxBackoffMs);
  }

  /** Returns the configured dormant retry interval in milliseconds. */
  get dormantRetryMs(): number {
    return this.config.dormantRetryMs;
  }

  /** Returns the maximum consecutive failures before entering dormant state. */
  get maxConsecutiveFailures(): number {
    return this.config.maxConsecutiveFailures;
  }
}
