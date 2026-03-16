"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.costAnalyzer = exports.CostAnalyzer = void 0;
const client_cost_explorer_1 = require("@aws-sdk/client-cost-explorer");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (daily refresh per Req 29.10)
// ─── Helpers ─────────────────────────────────────────────────────────────────
function isoDate(d) {
    return d.toISOString().slice(0, 10);
}
function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}
function sumResults(results) {
    return results.reduce((acc, r) => {
        const amount = parseFloat(r.Total?.['BlendedCost']?.Amount ?? '0');
        return acc + amount;
    }, 0);
}
function toDataPoints(results) {
    return results.map((r) => ({
        date: r.TimePeriod?.Start ?? '',
        amount: parseFloat(r.Total?.['BlendedCost']?.Amount ?? '0'),
    }));
}
// ─── CostAnalyzer ────────────────────────────────────────────────────────────
class CostAnalyzer {
    cache = null;
    ceClient = null;
    constructor() {
        // Lazily initialise the Cost Explorer client so missing credentials don't
        // crash the server at startup (Req: graceful handling of missing creds).
        try {
            this.ceClient = new client_cost_explorer_1.CostExplorerClient({ region: 'us-east-1' });
        }
        catch {
            this.ceClient = null;
        }
    }
    // ── Public API ─────────────────────────────────────────────────────────────
    async getSummary() {
        if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
            return this.cache.data;
        }
        const data = await this.fetchAll();
        this.cache = { data, fetchedAt: Date.now() };
        return data;
    }
    async getBreakdown() {
        const summary = await this.getSummary();
        return summary.breakdown;
    }
    // ── Fetching ───────────────────────────────────────────────────────────────
    async fetchAll() {
        const [awsCosts, gcpCosts] = await Promise.all([
            this.fetchAwsCosts(),
            this.fetchGcpCosts(),
        ]);
        const allResourceCosts = [...awsCosts, ...gcpCosts];
        const totalMonthlyCost = allResourceCosts.reduce((s, r) => s + r.amount, 0);
        const breakdown = this.aggregateCosts(allResourceCosts);
        const trends = await this.fetchTrends();
        return {
            totalMonthlyCost,
            currency: 'USD',
            breakdown,
            trends,
            resourceCosts: allResourceCosts,
            lastUpdated: new Date().toISOString(),
        };
    }
    // ── AWS Cost Explorer ──────────────────────────────────────────────────────
    async fetchAwsCosts() {
        if (!this.ceClient)
            return [];
        try {
            // Fetch last 30 days grouped by resource (RESOURCE granularity requires
            // Cost Allocation Tags or Resource-level cost tracking to be enabled).
            // We fall back to SERVICE grouping which is always available.
            const end = isoDate(new Date());
            const start = isoDate(daysAgo(30));
            const cmd = new client_cost_explorer_1.GetCostAndUsageCommand({
                TimePeriod: { Start: start, End: end },
                Granularity: client_cost_explorer_1.Granularity.MONTHLY,
                Metrics: ['BlendedCost'],
                GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
            });
            const response = await this.ceClient.send(cmd);
            const results = response.ResultsByTime ?? [];
            const costs = [];
            for (const result of results) {
                for (const group of result.Groups ?? []) {
                    const serviceKey = group.Keys?.[0] ?? 'unknown';
                    const amount = parseFloat(group.Metrics?.['BlendedCost']?.Amount ?? '0');
                    if (amount > 0) {
                        costs.push({
                            resourceId: `aws:service:${serviceKey}`,
                            amount,
                            currency: group.Metrics?.['BlendedCost']?.Unit ?? 'USD',
                        });
                    }
                }
            }
            return costs;
        }
        catch (err) {
            // Gracefully handle missing/invalid credentials (Req: graceful handling)
            return [];
        }
    }
    // ── GCP Cloud Billing (stub) ───────────────────────────────────────────────
    // GCP Cloud Billing requires OAuth2 / service account credentials that are
    // injected at runtime. Return an empty array as a stub (Req 29.2).
    async fetchGcpCosts() {
        return [];
    }
    // ── Aggregation ────────────────────────────────────────────────────────────
    aggregateCosts(costs) {
        const byProvider = {};
        const byType = {};
        const byRegion = {};
        const byTag = {};
        for (const c of costs) {
            // Derive provider from resourceId prefix (e.g. "aws:service:EC2")
            const provider = c.resourceId.startsWith('aws:') ? 'aws'
                : c.resourceId.startsWith('gcp:') ? 'gcp'
                    : 'unknown';
            byProvider[provider] = (byProvider[provider] ?? 0) + c.amount;
            // Derive type from the service name segment
            const segments = c.resourceId.split(':');
            const serviceSegment = segments[2] ?? 'unknown';
            const type = this.serviceToType(serviceSegment);
            byType[type] = (byType[type] ?? 0) + c.amount;
            // Region is not available from SERVICE grouping; use 'global' as default
            byRegion['global'] = (byRegion['global'] ?? 0) + c.amount;
        }
        return { byProvider, byType, byRegion, byTag };
    }
    serviceToType(service) {
        const s = service.toLowerCase();
        if (s.includes('ec2') || s.includes('compute'))
            return 'compute';
        if (s.includes('rds') || s.includes('sql') || s.includes('database'))
            return 'database';
        if (s.includes('s3') || s.includes('storage'))
            return 'storage';
        if (s.includes('lambda') || s.includes('function'))
            return 'function';
        if (s.includes('vpc') || s.includes('network') || s.includes('elb'))
            return 'network';
        return 'other';
    }
    // ── Trends ─────────────────────────────────────────────────────────────────
    async fetchTrends() {
        const [t7, t30, t90] = await Promise.all([
            this.fetchTrendWindow(7),
            this.fetchTrendWindow(30),
            this.fetchTrendWindow(90),
        ]);
        return { '7d': t7, '30d': t30, '90d': t90 };
    }
    async fetchTrendWindow(days) {
        if (!this.ceClient) {
            return { period: `${days}d`, dataPoints: [], total: 0 };
        }
        try {
            const end = isoDate(new Date());
            const start = isoDate(daysAgo(days));
            const cmd = new client_cost_explorer_1.GetCostAndUsageCommand({
                TimePeriod: { Start: start, End: end },
                Granularity: client_cost_explorer_1.Granularity.DAILY,
                Metrics: ['BlendedCost'],
            });
            const response = await this.ceClient.send(cmd);
            const results = response.ResultsByTime ?? [];
            const dataPoints = toDataPoints(results);
            const total = sumResults(results);
            return {
                period: `${days}d`,
                dataPoints,
                total,
            };
        }
        catch {
            return { period: `${days}d`, dataPoints: [], total: 0 };
        }
    }
}
exports.CostAnalyzer = CostAnalyzer;
// Singleton instance shared across requests
exports.costAnalyzer = new CostAnalyzer();
//# sourceMappingURL=costs.js.map