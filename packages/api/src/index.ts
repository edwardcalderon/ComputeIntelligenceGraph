import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { createRateLimiter } from './rate-limit';
import { registerRoutes } from './routes';
import { registerGraphQL } from './graphql';
import { registerWebSocket } from './websocket';
import { getMetrics, recordHttpRequest } from './metrics';
import { startHeartbeatMonitor } from './jobs/heartbeat-monitor';
import { closeDatabase } from './db/client';

const VERSION = '0.1.0';

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

export async function createServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  // CORS
  await app.register(cors, {
    origin: resolveCorsOrigins(),
  });

  // Rate limiting (100 req/min per client, Requirement 16.9)
  app.addHook('preHandler', createRateLimiter());

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
    return reply.send({
      status: 'ok',
      version: VERSION,
      timestamp: new Date().toISOString(),
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
    // Start background job for heartbeat status monitoring (Requirement 14.7)
    startHeartbeatMonitor();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Start server when run directly
if (require.main === module) {
  start();
}
