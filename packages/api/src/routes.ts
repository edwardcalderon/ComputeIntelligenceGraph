import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GraphEngine, GraphQueryEngine, ResourceFilters } from '@cig/graph';
import { CartographyClient } from '@cig/discovery';
import { authenticate, authorize, Permission } from './auth';
import { costAnalyzer } from './costs';
import { securityScanner } from './security';
import { newsletterManager } from './newsletter';
import { deviceAuthRoutes } from './routes/device-auth';
import { enrollmentRoutes } from './routes/enrollment';
import { heartbeatRoutes } from './routes/heartbeat';
import { bootstrapRoutes } from './routes/bootstrap';
import { oidcRoutes } from './routes/oidc';
import { auditRoutes } from './routes/audit';
import { sessionRoutes } from './routes/sessions';
import { scanRoutes } from './routes/scans';
import { chatRoutes } from './routes/chat';

import { authEmailRoutes } from './routes/auth-email';

// Shared instances
const graphEngine = new GraphEngine();
const queryEngine = new GraphQueryEngine();
const cartographyClient = new CartographyClient();

const readResources = [authenticate, authorize([Permission.READ_RESOURCES])];
const manageDiscovery = [authenticate, authorize([Permission.MANAGE_DISCOVERY])];
const executeActions = [authenticate, authorize([Permission.EXECUTE_ACTIONS])];

function parseInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'string') return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function emptyPagedResources() {
  return { items: [], total: 0, hasMore: false };
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // ─── Device Authorization (RFC 8628) ────────────────────────────────────────
  await app.register(deviceAuthRoutes);

  // ─── Target Enrollment (Requirement 13) ─────────────────────────────────────
  await app.register(enrollmentRoutes);

  // ─── Heartbeat (Requirement 14) ──────────────────────────────────────────────
  await app.register(heartbeatRoutes);

  // ─── Bootstrap (Requirement 15) ──────────────────────────────────────────────
  await app.register(bootstrapRoutes);

  // ─── OIDC Callback (Requirement 16) ──────────────────────────────────────────
  await app.register(oidcRoutes);

  // ─── Audit (Requirement 18) ──────────────────────────────────────────────────
  await app.register(auditRoutes);

  // ─── Session Management (Phase 1.3) ──────────────────────────────────────────
  await app.register(sessionRoutes);

  // ─── Scan Results (Phase 3.2) ────────────────────────────────────────────────
  await app.register(scanRoutes);

  // ─── Custom Auth Email Endpoints ─────────────────────────────────────────────
  await app.register(authEmailRoutes);

  // ─── Dashboard Chat Assistant ────────────────────────────────────────────────
  await app.register(chatRoutes);

  // ─── Resources ──────────────────────────────────────────────────────────────

  // GET /api/v1/resources — list all resources with optional filtering
  app.get(
    '/api/v1/resources',
    { preHandler: readResources },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string>;
      const filters: ResourceFilters = {};
      if (query['type']) filters.type = query['type'] as ResourceFilters['type'];
      if (query['provider']) filters.provider = query['provider'] as ResourceFilters['provider'];
      if (query['region']) filters.region = query['region'];
      if (query['state']) filters.state = query['state'] as ResourceFilters['state'];

      const limit = parseInteger(query['limit'], 50);
      const offset = parseInteger(query['offset'], 0);

      try {
        const result = await queryEngine.listResourcesPaged(filters, { limit, offset });
        return reply.send(result);
      } catch (error) {
        request.log.error(
          { err: error, limit, offset, filters },
          'Failed to list resources; returning an empty result set'
        );
        return reply.send(emptyPagedResources());
      }
    }
  );

  // GET /api/v1/resources/search — search resources by query string
  app.get(
    '/api/v1/resources/search',
    { preHandler: readResources },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { q } = request.query as { q?: string };
      if (!q) {
        return reply.status(400).send({ error: 'Missing query parameter: q', statusCode: 400 });
      }
      const resources = await queryEngine.searchResources(q);
      return reply.send({ items: resources, total: resources.length });
    }
  );

  // GET /api/v1/resources/:id — get resource by ID
  app.get(
    '/api/v1/resources/:id',
    { preHandler: readResources },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const resource = await graphEngine.getResource(id);
      if (!resource) {
        return reply.status(404).send({ error: 'Resource not found', statusCode: 404 });
      }
      return reply.send(resource);
    }
  );

  // GET /api/v1/resources/:id/dependencies — get resources this resource depends on
  app.get(
    '/api/v1/resources/:id/dependencies',
    { preHandler: readResources },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { depth } = request.query as { depth?: string };
      const deps = await queryEngine.getDependencies(id, depth ? parseInt(depth, 10) : 1);
      return reply.send({ items: deps, total: deps.length });
    }
  );

  // GET /api/v1/resources/:id/dependents — get resources that depend on this resource
  app.get(
    '/api/v1/resources/:id/dependents',
    { preHandler: readResources },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { depth } = request.query as { depth?: string };
      const dependents = await queryEngine.getDependents(id, depth ? parseInt(depth, 10) : 1);
      return reply.send({ items: dependents, total: dependents.length });
    }
  );

  // ─── Discovery ──────────────────────────────────────────────────────────────

  // GET /api/v1/discovery/status — get discovery status
  app.get(
    '/api/v1/discovery/status',
    { preHandler: readResources },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const status = await cartographyClient.getStatus();
      const recentRuns = await cartographyClient.getRecentRuns();
      return reply.send({ ...status, ...recentRuns });
    }
  );

  // POST /api/v1/discovery/trigger — manually trigger discovery
  app.post(
    '/api/v1/discovery/trigger',
    { preHandler: manageDiscovery },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await cartographyClient.triggerRun();
      return reply.status(202).send(result);
    }
  );

  // ─── Graph ──────────────────────────────────────────────────────────────────

  // POST /api/v1/graph/query — execute a custom Cypher query (read-only)
  app.post(
    '/api/v1/graph/query',
    { preHandler: readResources },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { query?: string; parameters?: Record<string, unknown> };
      if (!body?.query) {
        return reply.status(400).send({ error: 'Missing required field: query', statusCode: 400 });
      }
      // Delegate to searchResources as a simple passthrough for now;
      // full custom Cypher execution is handled by the graph package's Neo4j session.
      // For safety, only allow read queries (MATCH/CALL/WITH) and block write keywords anywhere in the query.
      const q = body.query.trim().toUpperCase();
      if (!q.startsWith('MATCH') && !q.startsWith('CALL') && !q.startsWith('WITH')) {
        return reply.status(400).send({ error: 'Only read queries (MATCH/CALL/WITH) are allowed', statusCode: 400 });
      }
      const WRITE_KEYWORDS = /\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP|FOREACH)\b/;
      if (WRITE_KEYWORDS.test(q)) {
        return reply.status(400).send({ error: 'Only read queries (MATCH/CALL/WITH) are allowed', statusCode: 400 });
      }
      // Return stub — full Cypher passthrough requires direct Neo4j session exposure
      return reply.send({ query: body.query, parameters: body.parameters ?? {}, results: [] });
    }
  );

  // ─── Costs (stub — implemented in later phases) ─────────────────────────────

  // GET /api/v1/costs — get cost summary
  app.get(
    '/api/v1/costs',
    { preHandler: readResources },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const summary = await costAnalyzer.getSummary();
      return reply.send(summary);
    }
  );

  // GET /api/v1/costs/breakdown — get cost breakdown by resource type/provider
  app.get(
    '/api/v1/costs/breakdown',
    { preHandler: readResources },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const breakdown = await costAnalyzer.getBreakdown();
      return reply.send(breakdown);
    }
  );

  // ─── Security (stub — implemented in later phases) ──────────────────────────

  // GET /api/v1/security/findings — get security findings (optionally filtered by resourceId)
  app.get(
    '/api/v1/security/findings',
    { preHandler: readResources },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { resourceId } = request.query as { resourceId?: string };
      const findings = await securityScanner.getFindings(resourceId);
      return reply.send({ items: findings, total: findings.length });
    }
  );

  // GET /api/v1/security/score — get overall security score
  app.get(
    '/api/v1/security/score',
    { preHandler: readResources },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const score = await securityScanner.getScore();
      return reply.send(score);
    }
  );

  // ─── Actions ────────────────────────────────────────────────────────────────

  // POST /api/v1/actions/execute — execute an infrastructure action
  app.post(
    '/api/v1/actions/execute',
    { preHandler: executeActions },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { action?: string; resourceId?: string; parameters?: Record<string, unknown> };
      if (!body?.action || !body?.resourceId) {
        return reply.status(400).send({ error: 'Missing required fields: action, resourceId', statusCode: 400 });
      }
      // Verify resource exists before accepting the action
      const resource = await graphEngine.getResource(body.resourceId);
      if (!resource) {
        return reply.status(404).send({ error: 'Resource not found', statusCode: 404 });
      }
      return reply.status(202).send({
        actionId: `action_${Date.now()}`,
        action: body.action,
        resourceId: body.resourceId,
        status: 'accepted',
        message: 'Action queued for execution',
      });
    }
  );

  // ─── Newsletter ──────────────────────────────────────────────────────────────

  // POST /api/v1/newsletter/subscribe — public endpoint, no auth required
  app.post(
    '/api/v1/newsletter/subscribe',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { email?: string; source?: string };
      if (!body?.email) {
        return reply.status(400).send({ error: 'Missing required field: email', statusCode: 400 });
      }
      try {
        const result = await newsletterManager.subscribe(body.email, body.source ?? 'landing');
        if (!result.success) {
          const status = result.duplicate ? 409 : 400;
          return reply.status(status).send({ error: result.message, statusCode: status });
        }
        return reply.status(201).send({ subscription: result.subscription });
      } catch (err) {
        app.log.error({ err }, 'Newsletter subscription error');
        return reply.status(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    }
  );

  // GET /api/v1/newsletter/subscriptions — admin-only list of all subscriptions
  app.get(
    '/api/v1/newsletter/subscriptions',
    { preHandler: [authenticate, authorize([Permission.ADMIN])] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const subscriptions = await newsletterManager.listSubscriptions();
        return reply.send({ subscriptions, total: subscriptions.length });
      } catch (err) {
        app.log.error({ err }, 'Newsletter list error');
        return reply.status(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    }
  );
}
