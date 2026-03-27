import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { createRateLimiter } from './rate-limit';
import { registerRoutes } from './routes';
import { registerGraphQL } from './graphql';
import { registerWebSocket } from './websocket';
import { getMetrics, recordHttpRequest } from './metrics';
import { startHeartbeatMonitor, stopHeartbeatMonitor } from './jobs/heartbeat-monitor';
import { startSemanticIndexSync, stopSemanticIndexSync } from './jobs/semantic-index-sync';
import { ensureDemoWorkspaceProvisioned } from './demo-workspace';
import { closeDatabase } from './db/client';

const VERSION = '0.1.0';
const RATE_LIMIT_EXEMPT_ROUTES = new Set(['GET /api/v1/health', 'GET /metrics']);
const OPENAI_MODEL_DEFAULT = 'gpt-4o-mini';
const OPENAI_HEALTH_CACHE_MS = 30_000;
const OPENAI_HEALTH_TIMEOUT_MS = 2_500;

type ChatHealthStatus = {
  provider: 'openai' | 'fallback';
  model: string;
  configured: boolean;
  reachable: boolean;
  providerReachable: boolean;
  checkedAt: string;
  latencyMs: number | null;
};

let openAiHealthCache: { checkedAt: number; status: ChatHealthStatus } | null = null;

export function startBackgroundJobs(app: FastifyInstance): void {
  startHeartbeatMonitor();
  startSemanticIndexSync(app.log);

  if (process.env.CIG_AUTH_MODE === 'managed' || process.env.CIG_DEMO_MODE === 'true') {
    void ensureDemoWorkspaceProvisioned(app.log).catch((error) => {
      app.log.warn(
        { err: error },
        'Demo workspace auto-provision failed; falling back to seeded demo snapshot'
      );
    });
  }
}

function resolveCorsOrigins(): true | string[] {
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

async function resolveChatHealth(endpointReady: boolean): Promise<ChatHealthStatus> {
  const model = process.env.OPENAI_CHAT_MODEL?.trim() || OPENAI_MODEL_DEFAULT;
  const apiKey = process.env.OPENAI_API_KEY?.trim() || '';
  const now = Date.now();

  if (openAiHealthCache && now - openAiHealthCache.checkedAt < OPENAI_HEALTH_CACHE_MS) {
    return openAiHealthCache.status;
  }

  const checkedAt = new Date().toISOString();

  if (!apiKey) {
    const status: ChatHealthStatus = {
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

    const status: ChatHealthStatus = {
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
  } catch (_error) {
    const status: ChatHealthStatus = {
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
  } finally {
    clearTimeout(timeout);
  }
}

export async function createServer(): Promise<FastifyInstance> {
  const multipart = require('@fastify/multipart') as typeof import('@fastify/multipart');
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    // The API is deployed behind a single public ALB. Trust one proxy hop so
    // Fastify resolves the real client IP from X-Forwarded-For and rate
    // limiting does not collapse all traffic into the load balancer address.
    trustProxy: 1,
  });

  // CORS
  await app.register(cors, {
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
  const rateLimit = createRateLimiter();
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const route = request.routeOptions?.url ?? request.url;
    const routeKey = `${request.method.toUpperCase()} ${route}`;

    if (RATE_LIMIT_EXEMPT_ROUTES.has(routeKey)) {
      return;
    }

    await rateLimit(request, reply);
  });

  // Record HTTP metrics on every response (Requirement 25.1–25.4)
  app.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
    const route = request.routerPath ?? request.url;
    recordHttpRequest(request.method, route, reply.statusCode, reply.elapsedTime);
    done();
  });

  // Global error handler
  app.setErrorHandler((error, _request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = error.statusCode ?? 500;
    app.log.error({ err: error }, 'Unhandled error');
    reply.status(statusCode).send({
      error: error.message ?? 'Internal Server Error',
      statusCode,
    });
  });

  // Health check
  app.get('/api/v1/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const chat = await resolveChatHealth(
      app.hasRoute({ method: 'POST', url: '/api/v1/chat' })
    );
    return reply.send({
      status: 'ok',
      version: VERSION,
      timestamp: new Date().toISOString(),
      chat,
    });
  });

  // Prometheus metrics endpoint (no auth — internal scraping, Requirement 25.1)
  app.get('/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    const metrics = await getMetrics();
    return reply.header('Content-Type', 'text/plain; version=0.0.4').send(metrics);
  });

  // Register all API routes
  await registerRoutes(app);

  // Register GraphQL API (Requirement 17.1)
  await registerGraphQL(app);

  // Register WebSocket server (Requirement 9.10)
  await registerWebSocket(app);

  app.addHook('onClose', async () => {
    stopHeartbeatMonitor();
    stopSemanticIndexSync();
    await closeDatabase();
  });

  return app;
}

export async function start(): Promise<void> {
  const port = parseInt(process.env.PORT ?? '3003', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  const app = await createServer();

  try {
    await app.listen({ port, host });
    app.log.info(`Server listening on ${host}:${port}`);
    // Start background jobs after the server is listening so startup remains responsive.
    startBackgroundJobs(app);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Start server when run directly
if (require.main === module) {
  start();
}
