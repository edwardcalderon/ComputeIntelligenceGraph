/**
 * Unit tests for the node status staleness checker.
 *
 * Covers:
 *   - Node with lastSeenAt 6 min ago  → status set to degraded
 *   - Node with lastSeenAt 16 min ago → status set to offline
 *   - Node with lastSeenAt 1 min ago  → status stays online (no update)
 *   - Revoked node                    → not touched
 *
 * Requirements: 16.3–16.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the DB client and SSE module before importing the checker
// ---------------------------------------------------------------------------

vi.mock('../db/client', () => ({
  query: vi.fn(),
}));

vi.mock('../sse/nodeStatus', () => ({
  pushNodeStatusEvent: vi.fn(),
}));

import { query } from '../db/client';
import { pushNodeStatusEvent } from '../sse/nodeStatus';
import {
  checkNodeStatuses,
  startNodeStatusChecker,
  stopNodeStatusChecker,
  getNodeStatusCheckerInterval,
  NODE_STATUS_CHECKER_INTERVAL_MS,
} from '../jobs/nodeStatusChecker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockQuery = query as ReturnType<typeof vi.fn>;
const mockPush  = pushNodeStatusEvent as ReturnType<typeof vi.fn>;

function minutesAgo(minutes: number, from: Date = new Date()): string {
  return new Date(from.getTime() - minutes * 60 * 1_000).toISOString();
}

function makeNode(
  id: string,
  status: string,
  lastSeenAt: string | null
): Record<string, unknown> {
  return { id, status, last_seen_at: lastSeenAt };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('checkNodeStatuses', () => {
  const NOW = new Date('2024-06-01T12:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: UPDATE queries return rowCount 1
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it('sets status to degraded for a node last seen 6 minutes ago', async () => {
    const node = makeNode('node-1', 'online', minutesAgo(6, NOW));
    mockQuery.mockResolvedValueOnce({ rows: [node], rowCount: 1 }); // SELECT
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });      // UPDATE

    const changed = await checkNodeStatuses(NOW);

    expect(changed).toBe(1);

    // The UPDATE call should set status = 'degraded'
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toContain("status = 'degraded'");
    expect(updateCall[1]).toContain('node-1');

    // SSE notification pushed
    expect(mockPush).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 'node-1', status: 'degraded', eventType: 'notification' })
    );
  });

  it('sets status to offline for a node last seen 16 minutes ago', async () => {
    const node = makeNode('node-2', 'online', minutesAgo(16, NOW));
    mockQuery.mockResolvedValueOnce({ rows: [node], rowCount: 1 }); // SELECT
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });      // UPDATE

    const changed = await checkNodeStatuses(NOW);

    expect(changed).toBe(1);

    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[0]).toContain("status = 'offline'");
    expect(updateCall[1]).toContain('node-2');

    expect(mockPush).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 'node-2', status: 'offline', eventType: 'alert' })
    );
  });

  it('does not change status for a node last seen 1 minute ago', async () => {
    const node = makeNode('node-3', 'online', minutesAgo(1, NOW));
    mockQuery.mockResolvedValueOnce({ rows: [node], rowCount: 1 }); // SELECT

    const changed = await checkNodeStatuses(NOW);

    expect(changed).toBe(0);
    // Only the SELECT was called — no UPDATE
    expect(mockQuery).toHaveBeenCalledOnce();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not touch a revoked node even if lastSeenAt is very old', async () => {
    // Revoked nodes are excluded by the WHERE clause in the SELECT
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT returns nothing

    const changed = await checkNodeStatuses(NOW);

    expect(changed).toBe(0);
    expect(mockQuery).toHaveBeenCalledOnce();
    // Verify the SELECT excludes revoked and credential-error nodes
    const selectCall = mockQuery.mock.calls[0];
    expect(selectCall[0]).toContain("status NOT IN ('revoked', 'credential-error')");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not update a node that is already degraded when it is still in the degraded window', async () => {
    const node = makeNode('node-4', 'degraded', minutesAgo(7, NOW));
    mockQuery.mockResolvedValueOnce({ rows: [node], rowCount: 1 }); // SELECT

    const changed = await checkNodeStatuses(NOW);

    // Already degraded — no change needed
    expect(changed).toBe(0);
    expect(mockQuery).toHaveBeenCalledOnce();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not update a node that is already offline when it is still in the offline window', async () => {
    const node = makeNode('node-5', 'offline', minutesAgo(20, NOW));
    mockQuery.mockResolvedValueOnce({ rows: [node], rowCount: 1 }); // SELECT

    const changed = await checkNodeStatuses(NOW);

    expect(changed).toBe(0);
    expect(mockQuery).toHaveBeenCalledOnce();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('skips nodes with null lastSeenAt (never sent a heartbeat)', async () => {
    const node = makeNode('node-6', 'enrolling', null);
    mockQuery.mockResolvedValueOnce({ rows: [node], rowCount: 1 }); // SELECT

    const changed = await checkNodeStatuses(NOW);

    expect(changed).toBe(0);
    expect(mockQuery).toHaveBeenCalledOnce();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('handles multiple nodes in a single pass', async () => {
    const nodes = [
      makeNode('node-a', 'online', minutesAgo(1, NOW)),   // healthy — no change
      makeNode('node-b', 'online', minutesAgo(6, NOW)),   // → degraded
      makeNode('node-c', 'online', minutesAgo(16, NOW)),  // → offline
    ];
    mockQuery.mockResolvedValueOnce({ rows: nodes, rowCount: 3 }); // SELECT
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });         // UPDATEs

    const changed = await checkNodeStatuses(NOW);

    expect(changed).toBe(2);
    expect(mockPush).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Interval management
// ---------------------------------------------------------------------------

describe('startNodeStatusChecker / stopNodeStatusChecker', () => {
  afterEach(() => {
    stopNodeStatusChecker();
  });

  it('starts an interval and returns a cleanup function', () => {
    const cleanup = startNodeStatusChecker();

    expect(getNodeStatusCheckerInterval()).not.toBeNull();
    expect(typeof cleanup).toBe('function');
  });

  it('calling start twice does not create a second interval', () => {
    startNodeStatusChecker();
    const handle1 = getNodeStatusCheckerInterval();

    startNodeStatusChecker();
    const handle2 = getNodeStatusCheckerInterval();

    expect(handle1).toBe(handle2);
  });

  it('cleanup function stops the interval', () => {
    const cleanup = startNodeStatusChecker();
    expect(getNodeStatusCheckerInterval()).not.toBeNull();

    cleanup();
    expect(getNodeStatusCheckerInterval()).toBeNull();
  });

  it('stopNodeStatusChecker clears the interval', () => {
    startNodeStatusChecker();
    expect(getNodeStatusCheckerInterval()).not.toBeNull();

    stopNodeStatusChecker();
    expect(getNodeStatusCheckerInterval()).toBeNull();
  });

  it('exports the correct interval duration', () => {
    expect(NODE_STATUS_CHECKER_INTERVAL_MS).toBe(60_000);
  });
});
