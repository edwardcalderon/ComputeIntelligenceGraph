import type { CartographyRunResponse, CartographyStatus, CartographyRecentRuns } from './types.js';
export declare class CartographyClient {
    private baseUrl;
    constructor(baseUrl?: string);
    triggerRun(): Promise<CartographyRunResponse>;
    getStatus(): Promise<CartographyStatus>;
    getRecentRuns(): Promise<CartographyRecentRuns>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=client.d.ts.map