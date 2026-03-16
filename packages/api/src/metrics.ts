import client from 'prom-client';

// Collect default Node.js metrics (memory, CPU, event loop, etc.)
client.collectDefaultMetrics();

// HTTP request duration histogram (labels: method, route, status_code)
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in milliseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

// HTTP request total counter (labels: method, route, status_code)
export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Discovery run total counter (labels: status)
export const discoveryRunTotal = new client.Counter({
  name: 'discovery_runs_total',
  help: 'Total number of discovery runs',
  labelNames: ['status'],
});

// Graph query duration histogram (labels: operation)
export const graphQueryDuration = new client.Histogram({
  name: 'graph_query_duration_ms',
  help: 'Duration of graph query operations in milliseconds',
  labelNames: ['operation'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

/**
 * Returns Prometheus text format metrics string.
 */
export async function getMetrics(): Promise<string> {
  return client.register.metrics();
}

/**
 * Records an HTTP request metric (duration + count).
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationMs: number
): void {
  const labels = { method, route, status_code: String(statusCode) };
  httpRequestDuration.observe(labels, durationMs);
  httpRequestTotal.inc(labels);
}
