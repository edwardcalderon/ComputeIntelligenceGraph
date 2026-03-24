"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
exports.start = start;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const rate_limit_1 = require("./rate-limit");
const routes_1 = require("./routes");
const graphql_1 = require("./graphql");
const websocket_1 = require("./websocket");
const metrics_1 = require("./metrics");
const heartbeat_monitor_1 = require("./jobs/heartbeat-monitor");
const VERSION = '0.1.0';
function resolveCorsOrigins() {
    const configuredOrigins = process.env.CORS_ORIGINS?.trim();
    if (configuredOrigins === '*') {
        return true;
    }
    if (configuredOrigins) {
        return configuredOrigins
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean);
    }
    if (process.env.NODE_ENV !== 'production') {
        return true;
    }
    // Default production fallback during domain migration.
    return [
        'https://cig.lat',
        'https://www.cig.lat',
        'https://edwardcalderon.github.io',
    ];
}
async function createServer() {
    const app = (0, fastify_1.default)({
        logger: {
            level: process.env.LOG_LEVEL ?? 'info',
        },
    });
    // CORS
    await app.register(cors_1.default, {
        origin: resolveCorsOrigins(),
    });
    // Rate limiting (100 req/min per client, Requirement 16.9)
    app.addHook('preHandler', (0, rate_limit_1.createRateLimiter)());
    // Record HTTP metrics on every response (Requirement 25.1–25.4)
    app.addHook('onResponse', (request, reply, done) => {
        const route = request.routerPath ?? request.url;
        (0, metrics_1.recordHttpRequest)(request.method, route, reply.statusCode, reply.elapsedTime);
        done();
    });
    // Global error handler
    app.setErrorHandler((error, _request, reply) => {
        const statusCode = error.statusCode ?? 500;
        app.log.error({ err: error }, 'Unhandled error');
        reply.status(statusCode).send({
            error: error.message ?? 'Internal Server Error',
            statusCode,
        });
    });
    // Health check
    app.get('/api/v1/health', async (_request, reply) => {
        return reply.send({
            status: 'ok',
            version: VERSION,
            timestamp: new Date().toISOString(),
        });
    });
    // Prometheus metrics endpoint (no auth — internal scraping, Requirement 25.1)
    app.get('/metrics', async (_request, reply) => {
        const metrics = await (0, metrics_1.getMetrics)();
        return reply.header('Content-Type', 'text/plain; version=0.0.4').send(metrics);
    });
    // Register all API routes
    await (0, routes_1.registerRoutes)(app);
    // Register GraphQL API (Requirement 17.1)
    await (0, graphql_1.registerGraphQL)(app);
    // Register WebSocket server (Requirement 9.10)
    await (0, websocket_1.registerWebSocket)(app);
    return app;
}
async function start() {
    const port = parseInt(process.env.PORT ?? '8080', 10);
    const host = process.env.HOST ?? '0.0.0.0';
    const app = await createServer();
    try {
        await app.listen({ port, host });
        app.log.info(`Server listening on ${host}:${port}`);
        // Start background job for heartbeat status monitoring (Requirement 14.7)
        (0, heartbeat_monitor_1.startHeartbeatMonitor)();
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
// Start server when run directly
if (require.main === module) {
    start();
}
//# sourceMappingURL=index.js.map