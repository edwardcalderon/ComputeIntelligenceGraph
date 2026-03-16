import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { createRateLimiter } from './rate-limit';
import { registerRoutes } from './routes';
import { registerGraphQL } from './graphql';
import { registerWebSocket } from './websocket';
import { getMetrics, recordHttpRequest } from './metrics';

const VERSION = '0.1.0';

export async function createServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  // CORS
  const corsOrigins = process.env.CORS_ORIGINS ?? '*';
  await app.register(cors, {
    origin: corsOrigins === '*' ? true : corsOrigins.split(',').map((o) => o.trim()),
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

  return app;
}

export async function start(): Promise<void> {
  const port = parseInt(process.env.PORT ?? '8080', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  const app = await createServer();

  try {
    await app.listen({ port, host });
    app.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Start server when run directly
if (require.main === module) {
  start();
}
