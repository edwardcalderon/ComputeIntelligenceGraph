"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBackgroundJobs = startBackgroundJobs;
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
const semantic_index_sync_1 = require("./jobs/semantic-index-sync");
const demo_workspace_1 = require("./demo-workspace");
const client_1 = require("./db/client");
const VERSION = '0.1.0';
const RATE_LIMIT_EXEMPT_ROUTES = new Set(['GET /api/v1/health', 'GET /metrics']);
const OPENAI_MODEL_DEFAULT = 'gpt-4o-mini';
const OPENAI_HEALTH_CACHE_MS = 30_000;
const OPENAI_HEALTH_TIMEOUT_MS = 2_500;
let openAiHealthCache = null;
function startBackgroundJobs(app) {
    (0, heartbeat_monitor_1.startHeartbeatMonitor)();
    (0, semantic_index_sync_1.startSemanticIndexSync)(app.log);
    if (process.env.CIG_AUTH_MODE === 'managed' || process.env.CIG_DEMO_MODE === 'true') {
        void (0, demo_workspace_1.ensureDemoWorkspaceProvisioned)(app.log).catch((error) => {
            app.log.warn({ err: error }, 'Demo workspace auto-provision failed; falling back to seeded demo snapshot');
        });
    }
}
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
async function resolveChatHealth(endpointReady) {
    const model = process.env.OPENAI_CHAT_MODEL?.trim() || OPENAI_MODEL_DEFAULT;
    const apiKey = process.env.OPENAI_API_KEY?.trim() || '';
    const now = Date.now();
    if (openAiHealthCache && now - openAiHealthCache.checkedAt < OPENAI_HEALTH_CACHE_MS) {
        return openAiHealthCache.status;
    }
    const checkedAt = new Date().toISOString();
    if (!apiKey) {
        const status = {
            provider: 'fallback',
            model,
            configured: false,
            reachable: endpointReady,
            providerReachable: false,
            checkedAt,
            latencyMs: null,
        };
        openAiHealthCache = { checkedAt: now, status };
        return status;
    }
    const controller = new AbortController();
    const startedAt = Date.now();
    const timeout = setTimeout(() => controller.abort(), OPENAI_HEALTH_TIMEOUT_MS);
    try {
        const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
            signal: controller.signal,
        });
        const status = {
            provider: 'openai',
            model,
            configured: true,
            reachable: endpointReady,
            providerReachable: response.ok,
            checkedAt,
            latencyMs: Date.now() - startedAt,
        };
        openAiHealthCache = { checkedAt: now, status };
        return status;
    }
    catch (_error) {
        const status = {
            provider: 'openai',
            model,
            configured: true,
            reachable: endpointReady,
            providerReachable: false,
            checkedAt,
            latencyMs: Date.now() - startedAt,
        };
        openAiHealthCache = { checkedAt: now, status };
        return status;
    }
    finally {
        clearTimeout(timeout);
    }
}
async function createServer() {
    const multipart = require('@fastify/multipart');
    const app = (0, fastify_1.default)({
        logger: {
            level: process.env.LOG_LEVEL ?? 'info',
        },
        // The API is deployed behind a single public ALB. Trust one proxy hop so
        // Fastify resolves the real client IP from X-Forwarded-For and rate
        // limiting does not collapse all traffic into the load balancer address.
        trustProxy: 1,
    });
    // CORS
    await app.register(cors_1.default, {
        origin: resolveCorsOrigins(),
    });
    await app.register(multipart, {
        limits: {
            files: 1,
        },
    });
    // Rate limiting (100 req/min per client, Requirement 16.9)
    // Operational endpoints stay exempt so health checks and metrics scraping
    // cannot be throttled by normal client traffic.
    const rateLimit = (0, rate_limit_1.createRateLimiter)();
    app.addHook('preHandler', async (request, reply) => {
        const route = request.routeOptions?.url ?? request.url;
        const routeKey = `${request.method.toUpperCase()} ${route}`;
        if (RATE_LIMIT_EXEMPT_ROUTES.has(routeKey)) {
            return;
        }
        await rateLimit(request, reply);
    });
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
        const chat = await resolveChatHealth(app.hasRoute({ method: 'POST', url: '/api/v1/chat' }));
        return reply.send({
            status: 'ok',
            version: VERSION,
            timestamp: new Date().toISOString(),
            chat,
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
    app.addHook('onClose', async () => {
        (0, heartbeat_monitor_1.stopHeartbeatMonitor)();
        (0, semantic_index_sync_1.stopSemanticIndexSync)();
        await (0, client_1.closeDatabase)();
    });
    return app;
}
async function start() {
    const port = parseInt(process.env.PORT ?? '3003', 10);
    const host = process.env.HOST ?? '0.0.0.0';
    const app = await createServer();
    try {
        await app.listen({ port, host });
        app.log.info(`Server listening on ${host}:${port}`);
        // Start background jobs after the server is listening so startup remains responsive.
        startBackgroundJobs(app);
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