/**
 * Node status staleness checker background job.
 *
 * Runs every minute and transitions ManagedNode statuses based on lastSeenAt:
 *   - lastSeenAt > 5 min ago  → set status `degraded`, push Dashboard notification
 *   - lastSeenAt > 15 min ago → set status `offline`,  push Dashboard alert
 *
 * Nodes with status `revoked` or `credential-error` are never touched.
 *
 * Requirements: 16.3–16.6
 */

import { query } from '../db/client';
import { pushNodeStatusEvent } from '../sse/nodeStatus';
import type { ManagedNode } from '../db/schema';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const NODE_STATUS_CHECKER_INTERVAL_MS = 60_000; // 1 minute
const DEGRADED_THRESHOLD_MS = 5 * 60 * 1_000;  // 5 minutes
const OFFLINE_THRESHOLD_MS  = 15 * 60 * 1_000; // 15 minutes

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _intervalHandle: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Core check logic (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Query all non-revoked, non-credential-error nodes and update their status
 * based on how long ago they last sent a heartbeat.
 *
 * Returns the number of nodes whose status was changed.
 */
export async function checkNodeStatuses(now: Date = new Date()): Promise<number> {
  const degradedCutoff = new Date(now.getTime() - DEGRADED_THRESHOLD_MS).toISOString();
  const offlineCutoff  = new Date(now.getTime() - OFFLINE_THRESHOLD_MS).toISOString();

  // Fetch all active nodes (exclude revoked / credential-error)
  const result = await query<ManagedNode>(
    `SELECT id, status, last_seen_at
       FROM managed_nodes
      WHERE status NOT IN ('revoked', 'credential-error')`,
    []
  );

  let changed = 0;

  for (const node of result.rows) {
    const lastSeenAt = node.last_seen_at ? new Date(node.last_seen_at).toISOString() : null;

    // Nodes that have never sent a heartbeat are left as-is (enrolling)
    if (!lastSeenAt) continue;

    const currentStatus = node.status;

    if (lastSeenAt < offlineCutoff) {
      // > 15 min — should be offline
      if (currentStatus !== 'offline') {
        await query(
          `UPDATE managed_nodes SET status = 'offline', updated_at = ? WHERE id = ?`,
          [now.toISOString(), node.id]
        );
        pushNodeStatusEvent({
          nodeId: node.id,
          status: 'offline',
          eventType: 'alert',
          timestamp: now.toISOString(),
        });
        changed++;
      }
    } else if (lastSeenAt < degradedCutoff) {
      // > 5 min but ≤ 15 min — should be degraded
      if (currentStatus !== 'degraded') {
        await query(
          `UPDATE managed_nodes SET status = 'degraded', updated_at = ? WHERE id = ?`,
          [now.toISOString(), node.id]
        );
        pushNodeStatusEvent({
          nodeId: node.id,
          status: 'degraded',
          eventType: 'notification',
          timestamp: now.toISOString(),
        });
        changed++;
      }
    }
    // ≤ 5 min — node is healthy; no downgrade needed
  }

  return changed;
}

// ---------------------------------------------------------------------------
// Interval management
// ---------------------------------------------------------------------------

/**
 * Return the current interval handle (for testing).
 */
export function getNodeStatusCheckerInterval(): ReturnType<typeof setInterval> | null {
  return _intervalHandle;
}

/**
 * Start the node status checker background job.
 * Safe to call multiple times — only one interval will run.
 *
 * @returns A cleanup function that stops the interval.
 */
export function startNodeStatusChecker(): () => void {
  if (_intervalHandle !== null) {
    return () => stopNodeStatusChecker();
  }

  _intervalHandle = setInterval(() => {
    checkNodeStatuses().catch((err: unknown) => {
      console.error('[nodeStatusChecker] Error during status check:', err);
    });
  }, NODE_STATUS_CHECKER_INTERVAL_MS);

  // Allow the process to exit even if the interval is still running
  if (_intervalHandle.unref) {
    _intervalHandle.unref();
  }

  return () => stopNodeStatusChecker();
}

/**
 * Stop the node status checker background job.
 */
export function stopNodeStatusChecker(): void {
  if (_intervalHandle !== null) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
}
