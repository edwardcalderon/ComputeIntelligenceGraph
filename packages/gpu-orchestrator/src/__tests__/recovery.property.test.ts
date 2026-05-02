/**
 * Property 7: Recovery Action Determination
 *
 * For any `HealthCheckResult` and consecutive failure count:
 * (a) if only the workerHeartbeat dimension is unhealthy and the session is
 *     healthy and failures < 5, the recovery action SHALL be `restart_worker`;
 * (b) if the session dimension is unhealthy and failures < 5, the recovery
 *     action SHALL be `recreate_session`;
 * (c) if consecutive failures >= 5 regardless of which dimensions are unhealthy,
 *     the recovery action SHALL be `enter_dormant`.
 *
 * **Validates: Requirements 8.2, 8.3, 8.5**
 *
 * Property 8: Exponential Backoff Calculation
 *
 * For any non-negative attempt number, `calculateBackoff(attempt)` returns
 * `min(30000 * 2^attempt, 900000)` ms.
 *
 * **Validates: Requirements 8.4**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  RecoveryStrategy,
  type HealthCheckResult,
  type HealthDimensionResult,
  type SessionHealthResult,
  type WorkerHeartbeatResult,
} from '../health/recovery.js';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Arbitrary for a valid ISO 8601 timestamp string. */
const arbIsoTimestamp: fc.Arbitrary<string> = fc
  .date({
    min: new Date('2020-01-01T00:00:00.000Z'),
    max: new Date('2030-12-31T23:59:59.999Z'),
  })
  .map((d) => d.toISOString());

/** Arbitrary for a non-negative latency in milliseconds. */
const arbLatencyMs: fc.Arbitrary<number> = fc.integer({ min: 0, max: 10_000 });

/** Arbitrary for a SessionHealthResult. */
const arbSessionHealth = (healthy: boolean): fc.Arbitrary<SessionHealthResult> =>
  fc.record({
    healthy: fc.constant(healthy),
    latencyMs: arbLatencyMs,
    status: fc.constantFrom('active', 'terminated', 'error', 'unknown'),
  });

/** Arbitrary for a WorkerHeartbeatResult. */
const arbWorkerHeartbeat = (healthy: boolean): fc.Arbitrary<WorkerHeartbeatResult> =>
  fc.record({
    healthy: fc.constant(healthy),
    latencyMs: arbLatencyMs,
    lastHeartbeatAt: fc.option(arbIsoTimestamp, { nil: undefined }),
    ageSeconds: fc.option(fc.integer({ min: 0, max: 3600 }), { nil: undefined }),
  });

/** Build a HealthCheckResult from session and heartbeat health booleans. */
const arbHealthCheckResult = (
  sessionHealthy: boolean,
  heartbeatHealthy: boolean,
): fc.Arbitrary<HealthCheckResult> =>
  fc.record({
    timestamp: arbIsoTimestamp,
    sessionId: fc.uuid(),
    checks: fc.record({
      session: arbSessionHealth(sessionHealthy),
      workerHeartbeat: arbWorkerHeartbeat(heartbeatHealthy),
    }),
    overall: fc.constant(sessionHealthy && heartbeatHealthy),
  });

// ---------------------------------------------------------------------------
// Property 7: Recovery Action Determination
// ---------------------------------------------------------------------------

describe('Property 7: Recovery Action Determination', () => {
  const strategy = new RecoveryStrategy();

  it('(a) returns restart_worker when only heartbeat is unhealthy and failures < 5', () => {
    fc.assert(
      fc.property(
        arbHealthCheckResult(/* sessionHealthy */ true, /* heartbeatHealthy */ false),
        fc.integer({ min: 0, max: 4 }),
        (healthResult, consecutiveFailures) => {
          const action = strategy.determineAction(healthResult, consecutiveFailures);
          expect(action.type).toBe('restart_worker');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('(b) returns recreate_session when session is unhealthy and failures < 5', () => {
    fc.assert(
      fc.property(
        // Session unhealthy, heartbeat can be either healthy or unhealthy
        fc.boolean().chain((heartbeatHealthy) =>
          arbHealthCheckResult(/* sessionHealthy */ false, heartbeatHealthy),
        ),
        fc.integer({ min: 0, max: 4 }),
        (healthResult, consecutiveFailures) => {
          const action = strategy.determineAction(healthResult, consecutiveFailures);
          expect(action.type).toBe('recreate_session');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('(c) returns enter_dormant when consecutive failures >= 5 regardless of health', () => {
    fc.assert(
      fc.property(
        fc.boolean().chain((sessionHealthy) =>
          fc.boolean().chain((heartbeatHealthy) =>
            arbHealthCheckResult(sessionHealthy, heartbeatHealthy),
          ),
        ),
        fc.integer({ min: 5, max: 1000 }),
        (healthResult, consecutiveFailures) => {
          const action = strategy.determineAction(healthResult, consecutiveFailures);
          expect(action.type).toBe('enter_dormant');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('covers all cases: for any health result and failure count, the action matches the spec rules', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.integer({ min: 0, max: 100 }),
        arbIsoTimestamp,
        fc.uuid(),
        arbLatencyMs,
        arbLatencyMs,
        (sessionHealthy, heartbeatHealthy, consecutiveFailures, timestamp, sessionId, sessionLatency, heartbeatLatency) => {
          const healthResult: HealthCheckResult = {
            timestamp,
            sessionId,
            checks: {
              session: { healthy: sessionHealthy, latencyMs: sessionLatency, status: 'active' },
              workerHeartbeat: { healthy: heartbeatHealthy, latencyMs: heartbeatLatency },
            },
            overall: sessionHealthy && heartbeatHealthy,
          };

          const action = strategy.determineAction(healthResult, consecutiveFailures);

          if (consecutiveFailures >= 5) {
            expect(action.type).toBe('enter_dormant');
          } else if (!sessionHealthy) {
            expect(action.type).toBe('recreate_session');
          } else {
            // Session is healthy — either heartbeat is unhealthy (restart_worker)
            // or both are healthy (still restart_worker per the implementation:
            // the function is only called on unhealthy results, but the logic
            // defaults to restart_worker when session is healthy)
            expect(action.type).toBe('restart_worker');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Exponential Backoff Calculation
// ---------------------------------------------------------------------------

describe('Property 8: Exponential Backoff Calculation', () => {
  const strategy = new RecoveryStrategy();

  it('calculateBackoff(attempt) equals min(30000 * 2^attempt, 900000) for any non-negative attempt', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (attempt) => {
          const actual = strategy.calculateBackoff(attempt);
          const expected = Math.min(30_000 * Math.pow(2, attempt), 900_000);
          expect(actual).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('backoff never exceeds maxBackoffMs (900000)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (attempt) => {
          const actual = strategy.calculateBackoff(attempt);
          expect(actual).toBeLessThanOrEqual(900_000);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('backoff is monotonically non-decreasing with attempt number', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        (attempt) => {
          const current = strategy.calculateBackoff(attempt);
          const next = strategy.calculateBackoff(attempt + 1);
          expect(next).toBeGreaterThanOrEqual(current);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('backoff at attempt 0 equals initialBackoffMs (30000)', () => {
    const actual = strategy.calculateBackoff(0);
    expect(actual).toBe(30_000);
  });
});
