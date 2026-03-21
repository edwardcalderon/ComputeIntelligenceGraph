"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const graph_1 = require("@cig/graph");
const discovery_1 = require("@cig/discovery");
const auth_1 = require("./auth");
const costs_1 = require("./costs");
const security_1 = require("./security");
const newsletter_1 = require("./newsletter");
// Shared instances
const graphEngine = new graph_1.GraphEngine();
const queryEngine = new graph_1.GraphQueryEngine();
const cartographyClient = new discovery_1.CartographyClient();
const readResources = [auth_1.authenticate, (0, auth_1.authorize)([auth_1.Permission.READ_RESOURCES])];
const manageDiscovery = [auth_1.authenticate, (0, auth_1.authorize)([auth_1.Permission.MANAGE_DISCOVERY])];
const executeActions = [auth_1.authenticate, (0, auth_1.authorize)([auth_1.Permission.EXECUTE_ACTIONS])];
async function registerRoutes(app) {
    // ─── Resources ──────────────────────────────────────────────────────────────
    // GET /api/v1/resources — list all resources with optional filtering
    app.get('/api/v1/resources', { preHandler: readResources }, async (request, reply) => {
        const query = request.query;
        const filters = {};
        if (query['type'])
            filters.type = query['type'];
        if (query['provider'])
            filters.provider = query['provider'];
        if (query['region'])
            filters.region = query['region'];
        if (query['state'])
            filters.state = query['state'];
        const limit = query['limit'] ? parseInt(query['limit'], 10) : 50;
        const offset = query['offset'] ? parseInt(query['offset'], 10) : 0;
        const result = await queryEngine.listResourcesPaged(filters, { limit, offset });
        return reply.send(result);
    });
    // GET /api/v1/resources/search — search resources by query string
    app.get('/api/v1/resources/search', { preHandler: readResources }, async (request, reply) => {
        const { q } = request.query;
        if (!q) {
            return reply.status(400).send({ error: 'Missing query parameter: q', statusCode: 400 });
        }
        const resources = await queryEngine.searchResources(q);
        return reply.send({ items: resources, total: resources.length });
    });
    // GET /api/v1/resources/:id — get resource by ID
    app.get('/api/v1/resources/:id', { preHandler: readResources }, async (request, reply) => {
        const { id } = request.params;
        const resource = await graphEngine.getResource(id);
        if (!resource) {
            return reply.status(404).send({ error: 'Resource not found', statusCode: 404 });
        }
        return reply.send(resource);
    });
    // GET /api/v1/resources/:id/dependencies — get resources this resource depends on
    app.get('/api/v1/resources/:id/dependencies', { preHandler: readResources }, async (request, reply) => {
        const { id } = request.params;
        const { depth } = request.query;
        const deps = await queryEngine.getDependencies(id, depth ? parseInt(depth, 10) : 1);
        return reply.send({ items: deps, total: deps.length });
    });
    // GET /api/v1/resources/:id/dependents — get resources that depend on this resource
    app.get('/api/v1/resources/:id/dependents', { preHandler: readResources }, async (request, reply) => {
        const { id } = request.params;
        const { depth } = request.query;
        const dependents = await queryEngine.getDependents(id, depth ? parseInt(depth, 10) : 1);
        return reply.send({ items: dependents, total: dependents.length });
    });
    // ─── Discovery ──────────────────────────────────────────────────────────────
    // GET /api/v1/discovery/status — get discovery status
    app.get('/api/v1/discovery/status', { preHandler: readResources }, async (_request, reply) => {
        const status = await cartographyClient.getStatus();
        const recentRuns = await cartographyClient.getRecentRuns();
        return reply.send({ ...status, ...recentRuns });
    });
    // POST /api/v1/discovery/trigger — manually trigger discovery
    app.post('/api/v1/discovery/trigger', { preHandler: manageDiscovery }, async (_request, reply) => {
        const result = await cartographyClient.triggerRun();
        return reply.status(202).send(result);
    });
    // ─── Graph ──────────────────────────────────────────────────────────────────
    // POST /api/v1/graph/query — execute a custom Cypher query (read-only)
    app.post('/api/v1/graph/query', { preHandler: readResources }, async (request, reply) => {
        const body = request.body;
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
    });
    // ─── Costs (stub — implemented in later phases) ─────────────────────────────
    // GET /api/v1/costs — get cost summary
    app.get('/api/v1/costs', { preHandler: readResources }, async (_request, reply) => {
        const summary = await costs_1.costAnalyzer.getSummary();
        return reply.send(summary);
    });
    // GET /api/v1/costs/breakdown — get cost breakdown by resource type/provider
    app.get('/api/v1/costs/breakdown', { preHandler: readResources }, async (_request, reply) => {
        const breakdown = await costs_1.costAnalyzer.getBreakdown();
        return reply.send(breakdown);
    });
    // ─── Security (stub — implemented in later phases) ──────────────────────────
    // GET /api/v1/security/findings — get security findings (optionally filtered by resourceId)
    app.get('/api/v1/security/findings', { preHandler: readResources }, async (request, reply) => {
        const { resourceId } = request.query;
        const findings = await security_1.securityScanner.getFindings(resourceId);
        return reply.send({ items: findings, total: findings.length });
    });
    // GET /api/v1/security/score — get overall security score
    app.get('/api/v1/security/score', { preHandler: readResources }, async (_request, reply) => {
        const score = await security_1.securityScanner.getScore();
        return reply.send(score);
    });
    // ─── Actions ────────────────────────────────────────────────────────────────
    // POST /api/v1/actions/execute — execute an infrastructure action
    app.post('/api/v1/actions/execute', { preHandler: executeActions }, async (request, reply) => {
        const body = request.body;
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
    });
    // ─── Newsletter ──────────────────────────────────────────────────────────────
    // POST /api/v1/newsletter/subscribe — public endpoint, no auth required
    app.post('/api/v1/newsletter/subscribe', async (request, reply) => {
        const body = request.body;
        if (!body?.email) {
            return reply.status(400).send({ error: 'Missing required field: email', statusCode: 400 });
        }
        try {
            const result = await newsletter_1.newsletterManager.subscribe(body.email, body.source ?? 'landing');
            if (!result.success) {
                const status = result.duplicate ? 409 : 400;
                return reply.status(status).send({ error: result.message, statusCode: status });
            }
            return reply.status(201).send({ subscription: result.subscription });
        }
        catch (err) {
            app.log.error({ err }, 'Newsletter subscription error');
            return reply.status(500).send({ error: 'Internal server error', statusCode: 500 });
        }
    });
    // GET /api/v1/newsletter/subscriptions — admin-only list of all subscriptions
    app.get('/api/v1/newsletter/subscriptions', { preHandler: [auth_1.authenticate, (0, auth_1.authorize)([auth_1.Permission.ADMIN])] }, async (_request, reply) => {
        try {
            const subscriptions = await newsletter_1.newsletterManager.listSubscriptions();
            return reply.send({ subscriptions, total: subscriptions.length });
        }
        catch (err) {
            app.log.error({ err }, 'Newsletter list error');
            return reply.status(500).send({ error: 'Internal server error', statusCode: 500 });
        }
    });
}
//# sourceMappingURL=routes.js.map