export interface ResourceCost {
    resourceId: string;
    amount: number;
    currency: string;
}
export interface CostBreakdown {
    byProvider: Record<string, number>;
    byType: Record<string, number>;
    byRegion: Record<string, number>;
    byTag: Record<string, number>;
}
export interface CostTrend {
    period: '7d' | '30d' | '90d';
    dataPoints: Array<{
        date: string;
        amount: number;
    }>;
    total: number;
}
export interface CostSummary {
    totalMonthlyCost: number;
    currency: string;
    breakdown: CostBreakdown;
    trends: {
        '7d': CostTrend;
        '30d': CostTrend;
        '90d': CostTrend;
    };
    resourceCosts: ResourceCost[];
    lastUpdated: string;
}
export declare class CostAnalyzer {
    private cache;
    private ceClient;
    constructor();
    getSummary(): Promise<CostSummary>;
    getBreakdown(): Promise<CostBreakdown>;
    private fetchAll;
    private fetchAwsCosts;
    private fetchGcpCosts;
    private aggregateCosts;
    private serviceToType;
    private fetchTrends;
    private fetchTrendWindow;
}
export declare const costAnalyzer: CostAnalyzer;
//# sourceMappingURL=costs.d.ts.map