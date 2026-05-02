/**
 * Property 9: Health Check Two-Dimension Reporting
 *
 * For any combination of session status (healthy/unhealthy) and worker
 * heartbeat freshness (healthy/unhealthy), the `HealthMonitor.checkAll()`
 * result SHALL contain both dimension results with boolean `healthy` fields
 * and non-negative `latencyMs` values, and the `overall` field SHALL be
 * `true` if and only if both dimensions are healthy.
 *
 * **Validates: Requirements 8.1**
 *
 * Property 12: Heartbeat Freshness Classification
 *
 * For any pair of timestamps (heartbeat timestamp, current timestamp) and a
 * threshold in seconds, the heartbeat check function SHALL return `true`
 * (healthy) if and only if the difference between current time and heartbeat
 * time is less than or equal to the threshold, and `false` (unhealthy)
 * otherwise.
 *
 * **Validates: Requirements 5.4, 5.5**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { HealthMonitor, isHeartbeatFresh } from '../health/monitor.js';
import type { ComputeProvider, SessionInfo } from '../providers/types.js';
import type { SessionRegistrar, WorkerHeartbeat } from '../state/session-registrar.js';
import type { Logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** No-op logger that satisfies the Logger interface without producing output. */
function createSilentLogger(): Logger {
  const noop = () => {};
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    critical: noop,
    child: () => createSilentLogger(),
  } as unknown as Logger;
}

/**
 * Build a mock ComputeProvider whose `getSessionStatus` returns a
 * controlled status value.
 *
 * @param healthy - When `true`, status is `'running'`; otherwise `'disconnected'`.
 */
function createMockProvider(healthy: boolean): ComputeProvider {
  const status = healthy ? 'running' : 'disconnected';
  return {
    providerName: 'mock',
    createSession: async () => ({}) as SessionInfo,
    destroySession: async () => {},
    getSessionStatus: async (sessionId: string): Promise<SessionInfo> => ({
      sessionId,
      status,
      provider: 'mock',
      startedAt: new Date().toISOString(),
      metadata: {},
    }),
    executeCommand: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    getSessionLogs: async () => '',
  };
}

/**
 * Build a mock SessionRegistrar whose `getWorkerHeartbeat` returns a
 * controlled heartbeat value.
 *
 * @param healthy - When `true`, heartbeat is fresh (now); otherwise stale (1 hour ago).
 * @param thresholdSeconds - The threshold used by the HealthMonitor so we
 *   can produce a heartbeat that is clearly within or outside the threshold.
 */
function createMockRegistrar(
  healthy: boolean,
  thresholdSeconds: number,
): SessionRegistrar {
  return {
    registerSession: async () => {},
    updateTimestamp: async () => {},
    removeSession: async () => {},
    getWorkerHeartbeat: async (): Promise<WorkerHeartbeat | null> => {
      const now = Date.now();
      // Fresh: 0 seconds ago (well within any positive threshold)
      // Stale: threshold + 60 seconds ago (clearly outside the threshold)
      const heartbeatMs = healthy ? now : now - (thresholdSeconds + 60) * 1000;
      return {
        lastHeartbeatAt: new Date(heartbeatMs).toISOString(),
        status: 'active',
      };
    },
  } as unknown as SessionRegistrar;
}

// ---------------------------------------------------------------------------
// Property 9: Health Check Two-Dimension Reporting
// ---------------------------------------------------------------------------

describe('Property 9: Health Check Two-Dimension Reporting', () => {
  it('checkAll() returns both dimensions with boolean healthy and non-negative latencyMs, and overall is true iff both healthy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.boolean(),
        fc.uuid(),
        fc.integer({ min: 10, max: 600 }),
        async (sessionHealthy, heartbeatHealthy, sessionId, thresholdSeconds) => {
          const provider = createMockProvider(sessionHealthy);
          const registrar = createMockRegistrar(heartbeatHealthy, thresholdSeconds);
          const logger = createSilentLogger();

          const monitor = new HealthMonitor(
            provider,
            registrar,
            logger,
            60_000,
            thresholdSeconds,
          );

          const result = await monitor.checkAll(sessionId);

          // Both dimensions present
          expect(result.checks.session).toBeDefined();
          expect(result.checks.workerHeartbeat).toBeDefined();

          // Session dimension has boolean healthy and non-negative latencyMs
          expect(typeof result.checks.session.healthy).toBe('boolean');
          expect(result.checks.session.latencyMs).toBeGreaterThanOrEqual(0);

          // Heartbeat dimension has boolean healthy and non-negative latencyMs
          expect(typeof result.checks.workerHeartbeat.healthy).toBe('boolean');
          expect(result.checks.workerHeartbeat.latencyMs).toBeGreaterThanOrEqual(0);

          // Session healthy matches our input
          expect(result.checks.session.healthy).toBe(sessionHealthy);

          // Heartbeat healthy matches our input
          expect(result.checks.workerHeartbeat.healthy).toBe(heartbeatHealthy);

          // Overall is true iff both dimensions are healthy
          const expectedOverall = sessionHealthy && heartbeatHealthy;
          expect(result.overall).toBe(expectedOverall);

          // Timestamp and sessionId are present
          expect(result.timestamp).toBeDefined();
          expect(result.sessionId).toBe(sessionId);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12: Heartbeat Freshness Classification
// ---------------------------------------------------------------------------

describe('Property 12: Heartbeat Freshness Classification', () => {
  it('isHeartbeatFresh returns true iff (currentMs - heartbeatMs) / 1000 <= thresholdSeconds', () => {
    fc.assert(
      fc.property(
        // Generate a heartbeat timestamp (epoch ms) in a reasonable range
        fc.integer({
          min: new Date('2020-01-01T00:00:00.000Z').getTime(),
          max: new Date('2030-01-01T00:00:00.000Z').getTime(),
        }),
        // Generate a non-negative offset in milliseconds (0 to 1 hour)
        fc.integer({ min: 0, max: 3_600_000 }),
        // Generate a positive threshold in seconds (1 to 600)
        fc.integer({ min: 1, max: 600 }),
        (heartbeatMs, offsetMs, thresholdSeconds) => {
          // Current timestamp is always >= heartbeat timestamp
          const currentMs = heartbeatMs + offsetMs;

          const heartbeatTimestamp = new Date(heartbeatMs).toISOString();
          const currentTimestamp = new Date(currentMs).toISOString();

          const result = isHeartbeatFresh(
            heartbeatTimestamp,
            currentTimestamp,
            thresholdSeconds,
          );

          // Expected: healthy iff age in seconds <= threshold
          const ageSeconds = (currentMs - heartbeatMs) / 1000;
          const expected = ageSeconds <= thresholdSeconds;

          expect(result).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});
