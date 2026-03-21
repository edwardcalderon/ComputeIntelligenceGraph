/**
 * Heartbeat monitor background job.
 *
 * Runs every 60 seconds and transitions node statuses based on last_seen:
 *   - last_seen > 5 min  → `degraded`
 *   - last_seen > 15 min → `offline`
 *
 * Requirements 8.7, 8.8, 14.7
 */

import { query } from '../db/client';

const JOB_INTERVAL_MS = 60_000; // 60 seconds
const DEGRADED_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const OFFLINE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Run a single pass of the heartbeat monitor.
 * Exported for testing.
 */
export async function runHeartbeatMonitor(): Promise<void> {
  const now = new Date();

  const degradedCutoff = new Date(now.getTime() - DEGRADED_THRESHOLD_MS).toISOString();
  const offlineCutoff = new Date(now.getTime() - OFFLINE_THRESHOLD_MS).toISOString();

  // Set nodes to `offline` first (more severe threshold)
  await query(
    `UPDATE managed_targets
        SET status = 'offline'
      WHERE status IN ('online', 'degraded')
        AND last_seen IS NOT NULL
        AND last_seen < ?`,
    [offlineCutoff]
  );

  // Set remaining online nodes to `degraded`
  await query(
    `UPDATE managed_targets
        SET status = 'degraded'
      WHERE status = 'online'
        AND last_seen IS NOT NULL
        AND last_seen < ?`,
    [degradedCutoff]
  );
}

/**
 * Start the heartbeat monitor background job.
 * Safe to call multiple times — only one interval will run.
 */
export function startHeartbeatMonitor(): void {
  if (intervalHandle !== null) return;

  intervalHandle = setInterval(() => {
    runHeartbeatMonitor().catch((err: unknown) => {
      console.error('[heartbeat-monitor] Error during status update:', err);
    });
  }, JOB_INTERVAL_MS);

  // Allow the process to exit even if the interval is still running
  if (intervalHandle.unref) {
    intervalHandle.unref();
  }
}

/**
 * Stop the heartbeat monitor background job.
 */
export function stopHeartbeatMonitor(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
