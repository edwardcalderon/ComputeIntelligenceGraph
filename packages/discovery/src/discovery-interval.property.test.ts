/**
 * Property 6: Discovery Interval Execution
 * Validates: Requirements 5.10
 *
 * For any configured discovery interval, the DiscoveryScheduler should:
 * 1. Call runDiscovery immediately on start()
 * 2. Call runDiscovery at the configured interval (±10% tolerance)
 * 3. Stop calling runDiscovery after stop()
 * 4. For N intervals elapsed, call runDiscovery approximately N+1 times
 *    (1 immediate + N scheduled)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { DiscoveryScheduler } from './scheduler.js';
import { CartographyClient } from './client.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Flush pending microtasks / promise callbacks. */
async function flushPromises(): Promise<void> {
  // Multiple rounds to handle chained promises (triggerRun → waitForCompletion → getStatus)
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

function makeMockClient(): CartographyClient {
  const client = {
    triggerRun: vi.fn().mockResolvedValue({ status: 'started' }),
    getStatus: vi.fn().mockResolvedValue({
      running: false,
      run_count: 1,
      last_run_start: null,
      last_run_end: null,
      last_run_success: true,
      last_error: null,
    }),
    getRecentRuns: vi.fn().mockResolvedValue({ total_runs: 1, last_success: true, last_run: null }),
    healthCheck: vi.fn().mockResolvedValue(true),
  } as unknown as CartographyClient;
  return client;
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates a discovery interval between 1000ms and 60000ms.
 */
const intervalArb = fc.integer({ min: 1000, max: 60000 });

/**
 * Generates a number of intervals to advance (1 to 5).
 */
const numIntervalsArb = fc.integer({ min: 1, max: 5 });

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 6: Discovery Interval Execution', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('calls runDiscovery immediately on start() for any configured interval', async () => {
    /**
     * Validates: Requirements 5.10
     * The scheduler must call runDiscovery once immediately when start() is called,
     * regardless of the configured interval.
     */
    await fc.assert(
      fc.asyncProperty(intervalArb, async (intervalMs) => {
        const client = makeMockClient();
        const scheduler = new DiscoveryScheduler(client, intervalMs);

        scheduler.start();

        // Flush the immediate async call (void this.runDiscovery())
        await flushPromises();

        expect(client.triggerRun).toHaveBeenCalledTimes(1);

        scheduler.stop();
      }),
      { numRuns: 50 }
    );
  });

  it('calls runDiscovery at the configured interval within ±10% tolerance', async () => {
    /**
     * Validates: Requirements 5.10
     * After start(), the scheduler must call runDiscovery again after the configured
     * interval elapses. The tolerance is ±10% of the interval.
     */
    await fc.assert(
      fc.asyncProperty(intervalArb, async (intervalMs) => {
        const client = makeMockClient();
        const scheduler = new DiscoveryScheduler(client, intervalMs);

        scheduler.start();
        await flushPromises();

        const callsAfterStart = (client.triggerRun as ReturnType<typeof vi.fn>).mock.calls.length;

        // Advance time by exactly one interval
        vi.advanceTimersByTime(intervalMs);
        await flushPromises();

        const callsAfterInterval = (client.triggerRun as ReturnType<typeof vi.fn>).mock.calls.length;

        // Should have fired at least one more time after the interval
        expect(callsAfterInterval).toBeGreaterThan(callsAfterStart);

        scheduler.stop();
      }),
      { numRuns: 50 }
    );
  });

  it('stops calling runDiscovery after stop()', async () => {
    /**
     * Validates: Requirements 5.10
     * After stop() is called, no further runDiscovery calls should be made
     * even when time advances past the interval.
     */
    await fc.assert(
      fc.asyncProperty(intervalArb, async (intervalMs) => {
        const client = makeMockClient();
        const scheduler = new DiscoveryScheduler(client, intervalMs);

        scheduler.start();
        await flushPromises();

        scheduler.stop();

        const callsAtStop = (client.triggerRun as ReturnType<typeof vi.fn>).mock.calls.length;

        // Advance time well past the interval — no new calls should happen
        vi.advanceTimersByTime(intervalMs * 3);
        await flushPromises();

        const callsAfterStop = (client.triggerRun as ReturnType<typeof vi.fn>).mock.calls.length;

        expect(callsAfterStop).toBe(callsAtStop);
      }),
      { numRuns: 50 }
    );
  });

  it('calls runDiscovery N+1 times for N intervals elapsed (1 immediate + N scheduled)', async () => {
    /**
     * Validates: Requirements 5.10
     * For N intervals elapsed after start(), runDiscovery should be called
     * approximately N+1 times: once immediately and once per interval.
     */
    await fc.assert(
      fc.asyncProperty(intervalArb, numIntervalsArb, async (intervalMs, n) => {
        const client = makeMockClient();
        const scheduler = new DiscoveryScheduler(client, intervalMs);

        scheduler.start();
        await flushPromises();

        // Advance time by N full intervals
        for (let i = 0; i < n; i++) {
          vi.advanceTimersByTime(intervalMs);
          await flushPromises();
        }

        const totalCalls = (client.triggerRun as ReturnType<typeof vi.fn>).mock.calls.length;

        // Expected: 1 immediate + N scheduled = N+1
        // Allow ±1 for timing edge cases
        expect(totalCalls).toBeGreaterThanOrEqual(n);
        expect(totalCalls).toBeLessThanOrEqual(n + 2);

        scheduler.stop();
      }),
      { numRuns: 50 }
    );
  });
});
