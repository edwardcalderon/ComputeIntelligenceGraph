"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphQueryDuration = exports.discoveryRunTotal = exports.httpRequestTotal = exports.httpRequestDuration = void 0;
exports.getMetrics = getMetrics;
exports.recordHttpRequest = recordHttpRequest;
const prom_client_1 = __importDefault(require("prom-client"));
// Collect default Node.js metrics (memory, CPU, event loop, etc.)
prom_client_1.default.collectDefaultMetrics();
// HTTP request duration histogram (labels: method, route, status_code)
exports.httpRequestDuration = new prom_client_1.default.Histogram({
    name: 'http_request_duration_ms',
    help: 'Duration of HTTP requests in milliseconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});
// HTTP request total counter (labels: method, route, status_code)
exports.httpRequestTotal = new prom_client_1.default.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
});
// Discovery run total counter (labels: status)
exports.discoveryRunTotal = new prom_client_1.default.Counter({
    name: 'discovery_runs_total',
    help: 'Total number of discovery runs',
    labelNames: ['status'],
});
// Graph query duration histogram (labels: operation)
exports.graphQueryDuration = new prom_client_1.default.Histogram({
    name: 'graph_query_duration_ms',
    help: 'Duration of graph query operations in milliseconds',
    labelNames: ['operation'],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});
/**
 * Returns Prometheus text format metrics string.
 */
async function getMetrics() {
    return prom_client_1.default.register.metrics();
}
/**
 * Records an HTTP request metric (duration + count).
 */
function recordHttpRequest(method, route, statusCode, durationMs) {
    const labels = { method, route, status_code: String(statusCode) };
    exports.httpRequestDuration.observe(labels, durationMs);
    exports.httpRequestTotal.inc(labels);
}
//# sourceMappingURL=metrics.js.map