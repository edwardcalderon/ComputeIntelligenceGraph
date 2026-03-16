import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiscoveryScheduler } from './scheduler.js';
import { CartographyClient } from './client.js';
import type { CartographyStatus } from './types.js';

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

function makeClient(overrides: Partial<{
  triggerRunResult: unknown;
  statusResult: Partial<CartographyStatus>;
  triggerRunError: Error;
}>  = {}): CartographyClient {
  const defaultStatus: CartographyStatus = {
    running: false,
    run_count: 1,
    last_run_start: null,
    last_run_end: null,
    last_run_success: true,
    last_error: null,
    ...overrides.statusResult,
  };

  return {
    triggerRun: overrides.triggerRunError
      ? vi.fn().mockRejectedValue(overrides.triggerRunError)
      : vi.fn().mockResolvedValue(overrides.triggerRunResult ?? { status: 'started' }),
    getStatus: vi.fn().mockResolvedValue(defaultStatus),
    getRecentRuns: vi.fn().mockResolvedValue({ total_runs: 1, last_success: true, last_run: null }),
    healthCheck: vi.fn().mockResolvedValue(true),
  } as unknown as CartographyClient;
}

describe('DiscoveryScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Run a single discovery cycle, advancing fake timers past the poll interval. */
  async function runOneCycle(scheduler: DiscoveryScheduler): Promise<void> {
    const p = scheduler.runDiscovery();
    // Advance past the 5-second poll sleep inside waitForCompletion
    await flushPromises();
    vi.advanceTimersByTime(6000);
    await flushPromises();
    await p;
  }

  // ── Event emission ─────────────────────────────────────────────────────────

  it('emits discovery_complete on successful run', async () => {
    const client = makeClient({ statusResult: { last_run_success: true } });
    const scheduler = new DiscoveryScheduler(client, 60_000);

    const events: unknown[] = [];
    scheduler.on('discovery_complete', (e) => events.push(e));

    await runOneCycle(scheduler);

    expect(events).toHaveLength(1);
    expect((events[0] as { type: string }).type).toBe('discovery_complete');
  });

  it('emits discovery_failed when triggerRun throws', async () => {
    const client = makeClient({ triggerRunError: new Error('connection refused') });
    const scheduler = new DiscoveryScheduler(client, 60_000);

    const events: unknown[] = [];
    scheduler.on('discovery_failed', (e) => events.push(e));

    await scheduler.runDiscovery();

    expect(events).toHaveLength(1);
    expect((events[0] as { type: string }).type).toBe('discovery_failed');
    expect((events[0] as { data: { error: string } }).data.error).toContain('connection refused');
  });

  it('emits discovery_failed when run reports failure', async () => {
    const client = makeClient({ statusResult: { last_run_success: false, last_error: 'neo4j unreachable' } });
    const scheduler = new DiscoveryScheduler(client, 60_000);

    const events: unknown[] = [];
    scheduler.on('discovery_failed', (e) => events.push(e));

    await runOneCycle(scheduler);

    expect(events).toHaveLength(1);
    expect((events[0] as { type: string }).type).toBe('discovery_failed');
  });

  // ── getRunHistory ──────────────────────────────────────────────────────────

  it('getRunHistory() returns empty array initially', () => {
    const scheduler = new DiscoveryScheduler(makeClient(), 60_000);
    expect(scheduler.getRunHistory()).toEqual([]);
  });

  it('getRunHistory() returns stored runs after runDiscovery', async () => {
    const client = makeClient();
    const scheduler = new DiscoveryScheduler(client, 60_000);

    await runOneCycle(scheduler);

    expect(scheduler.getRunHistory()).toHaveLength(1);
  });

  it('getRunHistory() returns a copy, not the internal array', async () => {
    const client = makeClient();
    const scheduler = new DiscoveryScheduler(client, 60_000);

    await runOneCycle(scheduler);

    const history = scheduler.getRunHistory();
    history.push({} as never);

    expect(scheduler.getRunHistory()).toHaveLength(1);
  });

  // ── getLastRun ─────────────────────────────────────────────────────────────

  it('getLastRun() returns undefined initially', () => {
    const scheduler = new DiscoveryScheduler(makeClient(), 60_000);
    expect(scheduler.getLastRun()).toBeUndefined();
  });

  it('getLastRun() returns the most recent run', async () => {
    const client = makeClient();
    const scheduler = new DiscoveryScheduler(client, 60_000);

    await runOneCycle(scheduler);
    await runOneCycle(scheduler);

    const history = scheduler.getRunHistory();
    expect(scheduler.getLastRun()).toBe(history[history.length - 1]);
  });

  // ── Run history cap ────────────────────────────────────────────────────────

  it('run history is capped at 100 entries', async () => {
    const client = makeClient();
    const scheduler = new DiscoveryScheduler(client, 60_000);

    for (let i = 0; i < 105; i++) {
      await runOneCycle(scheduler);
    }

    expect(scheduler.getRunHistory().length).toBeLessThanOrEqual(100);
  });
});
