import client from 'prom-client';
export declare const httpRequestDuration: client.Histogram<"method" | "route" | "status_code">;
export declare const httpRequestTotal: client.Counter<"method" | "route" | "status_code">;
export declare const discoveryRunTotal: client.Counter<"status">;
export declare const graphQueryDuration: client.Histogram<"operation">;
/**
 * Returns Prometheus text format metrics string.
 */
export declare function getMetrics(): Promise<string>;
/**
 * Records an HTTP request metric (duration + count).
 */
export declare function recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number): void;
//# sourceMappingURL=metrics.d.ts.map