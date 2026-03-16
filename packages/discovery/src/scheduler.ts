import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { CartographyClient } from './client.js';
import type { DiscoveryRun, DiscoveryEvent } from './types.js';

const MAX_RUN_HISTORY = 100;
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class DiscoveryScheduler extends EventEmitter {
  private client: CartographyClient;
  private intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private runs: DiscoveryRun[] = [];

  constructor(
    client?: CartographyClient,
    intervalMs: number = parseInt(process.env.DISCOVERY_INTERVAL_MS ?? '0') ||
      (parseInt(process.env.DISCOVERY_INTERVAL_MINUTES ?? '0') * 60 * 1000) ||
      DEFAULT_INTERVAL_MS,
  ) {
    super();
    this.client = client ?? new CartographyClient();
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.timer) return;
    // Run immediately on start, then on interval
    void this.runDiscovery();
    this.timer = setInterval(() => void this.runDiscovery(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getRunHistory(): DiscoveryRun[] {
    return [...this.runs];
  }

  getLastRun(): DiscoveryRun | undefined {
    return this.runs[this.runs.length - 1];
  }

  async runDiscovery(): Promise<DiscoveryRun> {
    const run: DiscoveryRun = {
      id: randomUUID(),
      status: 'running',
      startedAt: new Date(),
    };

    this.addRun(run);

    try {
      const response = await this.client.triggerRun();

      if (response.status === 'already_running') {
        // Poll until done
        await this.waitForCompletion(run);
      } else {
        // Wait for the run to finish
        await this.waitForCompletion(run);
      }
    } catch (err) {
      run.status = 'failed';
      run.completedAt = new Date();
      run.success = false;
      run.error = err instanceof Error ? err.message : String(err);

      const event: DiscoveryEvent = {
        type: 'discovery_failed',
        runId: run.id,
        timestamp: run.completedAt,
        data: { error: run.error },
      };
      this.emit('discovery_failed', event);
      console.error(`[DiscoveryScheduler] Run ${run.id} failed:`, run.error);
    }

    return run;
  }

  private async waitForCompletion(run: DiscoveryRun): Promise<void> {
    const pollInterval = 5000; // 5 seconds
    const maxWait = 30 * 60 * 1000; // 30 minutes
    const deadline = Date.now() + maxWait;

    while (Date.now() < deadline) {
      await sleep(pollInterval);

      try {
        const status = await this.client.getStatus();

        if (!status.running) {
          run.completedAt = new Date();
          run.success = status.last_run_success ?? false;
          run.status = run.success ? 'completed' : 'failed';
          run.error = status.last_error ?? undefined;

          if (run.success) {
            const event: DiscoveryEvent = {
              type: 'discovery_complete',
              runId: run.id,
              timestamp: run.completedAt,
              data: { runCount: status.run_count },
            };
            this.emit('discovery_complete', event);

            const resourceEvent: DiscoveryEvent = {
              type: 'resource_discovered',
              runId: run.id,
              timestamp: run.completedAt,
            };
            this.emit('resource_discovered', resourceEvent);
          } else {
            const event: DiscoveryEvent = {
              type: 'discovery_failed',
              runId: run.id,
              timestamp: run.completedAt,
              data: { error: run.error },
            };
            this.emit('discovery_failed', event);
          }

          return;
        }
      } catch (err) {
        console.warn(`[DiscoveryScheduler] Poll error for run ${run.id}:`, err);
      }
    }

    // Timed out
    run.status = 'failed';
    run.completedAt = new Date();
    run.success = false;
    run.error = 'Discovery run timed out';

    const event: DiscoveryEvent = {
      type: 'discovery_failed',
      runId: run.id,
      timestamp: run.completedAt,
      data: { error: run.error },
    };
    this.emit('discovery_failed', event);
  }

  private addRun(run: DiscoveryRun): void {
    this.runs.push(run);
    if (this.runs.length > MAX_RUN_HISTORY) {
      this.runs.splice(0, this.runs.length - MAX_RUN_HISTORY);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
