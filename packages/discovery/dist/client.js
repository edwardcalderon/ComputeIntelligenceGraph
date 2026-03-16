"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CartographyClient = void 0;
class CartographyClient {
    baseUrl;
    constructor(baseUrl = process.env.CARTOGRAPHY_URL ?? 'http://cartography:8001') {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }
    async triggerRun() {
        const res = await fetch(`${this.baseUrl}/run`, { method: 'POST' });
        if (!res.ok) {
            throw new Error(`Cartography /run failed: ${res.status} ${res.statusText}`);
        }
        return res.json();
    }
    async getStatus() {
        const res = await fetch(`${this.baseUrl}/status`);
        if (!res.ok) {
            throw new Error(`Cartography /status failed: ${res.status} ${res.statusText}`);
        }
        return res.json();
    }
    async getRecentRuns() {
        const res = await fetch(`${this.baseUrl}/runs`);
        if (!res.ok) {
            throw new Error(`Cartography /runs failed: ${res.status} ${res.statusText}`);
        }
        return res.json();
    }
    async healthCheck() {
        try {
            const res = await fetch(`${this.baseUrl}/health`);
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
exports.CartographyClient = CartographyClient;
//# sourceMappingURL=client.js.map