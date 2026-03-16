import { EventEmitter } from 'node:events';
import { CartographyClient } from './client.js';
import type { DiscoveryRun } from './types.js';
export declare class DiscoveryScheduler extends EventEmitter {
    private client;
    private intervalMs;
    private timer;
    private runs;
    constructor(client?: CartographyClient, intervalMs?: number);
    start(): void;
    stop(): void;
    getRunHistory(): DiscoveryRun[];
    getLastRun(): DiscoveryRun | undefined;
    runDiscovery(): Promise<DiscoveryRun>;
    private waitForCompletion;
    private addRun;
}
//# sourceMappingURL=scheduler.d.ts.map