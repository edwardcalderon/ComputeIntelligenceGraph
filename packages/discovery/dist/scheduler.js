"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscoveryScheduler = void 0;
const node_events_1 = require("node:events");
const node_crypto_1 = require("node:crypto");
const client_js_1 = require("./client.js");
const MAX_RUN_HISTORY = 100;
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
class DiscoveryScheduler extends node_events_1.EventEmitter {
    client;
    intervalMs;
    timer = null;
    runs = [];
    constructor(client, intervalMs = parseInt(process.env.DISCOVERY_INTERVAL_MS ?? '0') ||
        (parseInt(process.env.DISCOVERY_INTERVAL_MINUTES ?? '0') * 60 * 1000) ||
        DEFAULT_INTERVAL_MS) {
        super();
        this.client = client ?? new client_js_1.CartographyClient();
        this.intervalMs = intervalMs;
    }
    start() {
        if (this.timer)
            return;
        // Run immediately on start, then on interval
        void this.runDiscovery();
        this.timer = setInterval(() => void this.runDiscovery(), this.intervalMs);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    getRunHistory() {
        return [...this.runs];
    }
    getLastRun() {
        return this.runs[this.runs.length - 1];
    }
    async runDiscovery() {
        const run = {
            id: (0, node_crypto_1.randomUUID)(),
            status: 'running',
            startedAt: new Date(),
        };
        this.addRun(run);
        try {
            const response = await this.client.triggerRun();
            if (response.status === 'already_running') {
                // Poll until done
                await this.waitForCompletion(run);
            }
            else {
                // Wait for the run to finish
                await this.waitForCompletion(run);
            }
        }
        catch (err) {
            run.status = 'failed';
            run.completedAt = new Date();
            run.success = false;
            run.error = err instanceof Error ? err.message : String(err);
            const event = {
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
    async waitForCompletion(run) {
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
                        const event = {
                            type: 'discovery_complete',
                            runId: run.id,
                            timestamp: run.completedAt,
                            data: { runCount: status.run_count },
                        };
                        this.emit('discovery_complete', event);
                        const resourceEvent = {
                            type: 'resource_discovered',
                            runId: run.id,
                            timestamp: run.completedAt,
                        };
                        this.emit('resource_discovered', resourceEvent);
                    }
                    else {
                        const event = {
                            type: 'discovery_failed',
                            runId: run.id,
                            timestamp: run.completedAt,
                            data: { error: run.error },
                        };
                        this.emit('discovery_failed', event);
                    }
                    return;
                }
            }
            catch (err) {
                console.warn(`[DiscoveryScheduler] Poll error for run ${run.id}:`, err);
            }
        }
        // Timed out
        run.status = 'failed';
        run.completedAt = new Date();
        run.success = false;
        run.error = 'Discovery run timed out';
        const event = {
            type: 'discovery_failed',
            runId: run.id,
            timestamp: run.completedAt,
            data: { error: run.error },
        };
        this.emit('discovery_failed', event);
    }
    addRun(run) {
        this.runs.push(run);
        if (this.runs.length > MAX_RUN_HISTORY) {
            this.runs.splice(0, this.runs.length - MAX_RUN_HISTORY);
        }
    }
}
exports.DiscoveryScheduler = DiscoveryScheduler;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=scheduler.js.map