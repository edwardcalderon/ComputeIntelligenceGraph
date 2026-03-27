import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { CartographyClient } from '@cig/discovery';
import { GraphEngine, GraphQueryEngine, type Resource_Model, type Relationship as GraphRelationship } from '@cig/graph';
import type {
  GraphDiscoverySnapshot,
  GraphRefinementPreviewChange,
  GraphRefinementProposal,
  GraphRefinementRequest,
  GraphRefinementResponse,
  GraphSource,
  GraphSnapshot,
  Relationship,
  Resource,
} from '@cig/sdk';
import { authenticate, authorize, Permission } from '../auth';
import { buildDemoWorkspaceGraphSnapshot } from '../demo-workspace';

const queryEngine = new GraphQueryEngine();
const graphEngine = new GraphEngine();
const cartographyClient = new CartographyClient();

const readResources = [authenticate, authorize([Permission.READ_RESOURCES])];
const writeResources = [authenticate, authorize([Permission.WRITE_RESOURCES])];

const DEFAULT_DISCOVERY_INTERVAL_MINUTES = 5;
const DEFAULT_RESOURCE_LIMIT = 500;
const DEFAULT_RELATIONSHIP_LIMIT = 1000;

function parseInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveDiscoveryIntervalMinutes(): number {
  const parsed = Number.parseInt(process.env.DISCOVERY_INTERVAL_MINUTES ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DISCOVERY_INTERVAL_MINUTES;
}

function resolveNextRun(lastRun: string | null): string | null {
  if (!lastRun) return null;
  const startedAt = new Date(lastRun);
  if (Number.isNaN(startedAt.getTime())) return null;
  startedAt.setMinutes(startedAt.getMinutes() + resolveDiscoveryIntervalMinutes());
  return startedAt.toISOString();
}

function normalizeGraphSource(value: unknown): GraphSource {
  return value === 'demo' ? 'demo' : 'live';
}

function emptyGraphSnapshot(source: GraphSource): GraphSnapshot {
  return {
    source: {
      kind: source,
      available: false,
      lastSyncedAt: null,
    },
    resourceCounts: {},
    resources: [],
    relationships: [],
    discovery: {
      healthy: false,
      running: false,
      lastRun: null,
      nextRun: null,
    },
  };
}

function buildDiscoverySnapshot(
  healthy: boolean,
  status: { running?: boolean; last_run_start?: string | null; last_run_end?: string | null } | null,
  recentRuns: { last_run?: string | null } | null,
): GraphDiscoverySnapshot {
  const lastRun = recentRuns?.last_run ?? status?.last_run_end ?? status?.last_run_start ?? null;
  return {
    healthy,
    running: status?.running ?? false,
    lastRun,
    nextRun: resolveNextRun(lastRun),
  };
}

function mapResource(resource: Resource_Model): Resource {
  return {
    id: resource.id,
    type: resource.type,
    provider: resource.provider,
    name: resource.name,
    region: resource.region,
    state: resource.state,
    tags: resource.tags,
  };
}

function normalizeResponseText(message: string): string {
  return message.trim().replace(/\s+/g, ' ');
}

function stripMarkdownFence(value: string): string {
  return value.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
}

function isGraphMutation(query: string): boolean {
  return /\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP|FOREACH)\b/i.test(query);
}

function isDestructiveMutation(query: string): boolean {
  return /\b(DELETE|DETACH\s+DELETE|DROP)\b/i.test(query);
}

function buildPreviewChangeCount(previewDiff: GraphRefinementPreviewChange[]): {
  affectedNodes: number;
  affectedRelationships: number;
} {
  return {
    affectedNodes: previewDiff.filter((change) => change.kind === 'resource').length,
    affectedRelationships: previewDiff.filter((change) => change.kind === 'relationship').length,
  };
}

function relationshipKey(relationship: { sourceId: string; targetId: string; type: string }): string {
  return `${relationship.sourceId}:${relationship.type}:${relationship.targetId}`;
}

function mapRelationship(relationship: GraphRelationship): Relationship {
  return {
    sourceId: relationship.fromId,
    targetId: relationship.toId,
    type: relationship.type,
  };
}

function validatePreviewDiff(
  proposal: GraphRefinementProposal,
  snapshot: GraphSnapshot,
): string | null {
  const resourceIds = new Set(snapshot.resources.map((resource) => resource.id));
  const relationshipIds = new Set(snapshot.relationships.map(relationshipKey));

  for (const change of proposal.previewDiff) {
    if (change.kind === 'resource') {
      if (!resourceIds.has(change.id)) {
        return `Preview references unknown resource id: ${change.id}`;
      }
      continue;
    }

    if (relationshipIds.has(change.id)) {
      continue;
    }

    if (change.action !== 'create') {
      return `Preview references unknown relationship id: ${change.id}`;
    }

    const parts = change.id.split(':');
    if (parts.length !== 3) {
      return `Created relationship ids must use the form fromId:TYPE:toId. Invalid id: ${change.id}`;
    }

    const [fromId, , toId] = parts;
    if (!resourceIds.has(fromId) || !resourceIds.has(toId)) {
      return `Preview references unknown relationship endpoints: ${change.id}`;
    }
  }

  return null;
}

async function buildLiveGraphSnapshot(): Promise<GraphSnapshot> {
  const [resourceCountsResult, resourcesResult, relationshipsResult, healthResult, statusResult, recentRunsResult] = await Promise.allSettled([
    queryEngine.getResourceCounts(),
    queryEngine.listResourcesPaged(undefined, { limit: DEFAULT_RESOURCE_LIMIT }),
    queryEngine.listRelationships(DEFAULT_RELATIONSHIP_LIMIT),
    cartographyClient.healthCheck(),
    cartographyClient.getStatus(),
    cartographyClient.getRecentRuns(),
  ]);

  const resourceCounts = resourceCountsResult.status === 'fulfilled' ? resourceCountsResult.value : {};
  const resources =
    resourcesResult.status === 'fulfilled'
      ? resourcesResult.value.items.slice(0, DEFAULT_RESOURCE_LIMIT).map(mapResource)
      : [];
  const relationships =
    relationshipsResult.status === 'fulfilled'
      ? relationshipsResult.value.slice(0, DEFAULT_RELATIONSHIP_LIMIT).map(mapRelationship)
      : [];
  const discoveryHealthy = healthResult.status === 'fulfilled' ? healthResult.value : false;
  const status = statusResult.status === 'fulfilled' ? statusResult.value : null;
  const recentRuns = recentRunsResult.status === 'fulfilled' ? recentRunsResult.value : null;

  return {
    source: {
      kind: 'live',
      available: discoveryHealthy,
      lastSyncedAt: status?.last_run_end ?? status?.last_run_start ?? null,
    },
    resourceCounts,
    resources,
    relationships,
    discovery: buildDiscoverySnapshot(discoveryHealthy, status, recentRuns),
  };
}

async function buildGraphSnapshot(source: GraphSource): Promise<GraphSnapshot> {
  if (source === 'demo') {
    try {
      return await buildDemoWorkspaceGraphSnapshot();
    } catch {
      return emptyGraphSnapshot('demo');
    }
  }

  try {
    return await buildLiveGraphSnapshot();
  } catch {
    return emptyGraphSnapshot('live');
  }
}

export async function graphRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/v1/relationships',
    { preHandler: readResources },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { limit?: string };
      const limit = parseInteger(query.limit, DEFAULT_RELATIONSHIP_LIMIT);
      const items = (await queryEngine.listRelationships(limit)).map(mapRelationship);
      return reply.send({ items, total: items.length });
    }
  );

  app.get(
    '/api/v1/graph/snapshot',
    { preHandler: readResources },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { source?: string };
      const snapshot = await buildGraphSnapshot(normalizeGraphSource(query.source));
      return reply.send(snapshot);
    }
  );

  app.post(
    '/api/v1/graph/query',
    { preHandler: readResources },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { query?: string; parameters?: Record<string, unknown> };
      if (!body?.query) {
        return reply.status(400).send({ error: 'Missing required field: query', statusCode: 400 });
      }

      const normalized = body.query.trim();
      const upper = normalized.toUpperCase();
      const readPrefixes = ['MATCH', 'CALL', 'WITH', 'UNWIND', 'EXPLAIN', 'PROFILE'];
      if (!readPrefixes.some((prefix) => upper.startsWith(prefix))) {
        return reply.status(400).send({ error: 'Only read queries (MATCH/CALL/WITH/UNWIND/EXPLAIN/PROFILE) are allowed', statusCode: 400 });
      }

      if (isGraphMutation(upper)) {
        return reply.status(400).send({ error: 'Only read queries (MATCH/CALL/WITH/UNWIND/EXPLAIN/PROFILE) are allowed', statusCode: 400 });
      }

      return reply.send({
        query: normalized,
        parameters: body.parameters ?? {},
        results: [],
      });
    }
  );

  app.post(
    '/api/v1/graph/refine',
    { preHandler: writeResources },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Partial<GraphRefinementRequest> & { goal?: string };
      const goal = typeof body.goal === 'string' ? normalizeResponseText(body.goal) : '';
      const proposal = body.proposal;

      if (!goal) {
        return reply.status(400).send({ error: 'Missing required field: goal', statusCode: 400 });
      }

      if (!proposal || typeof proposal.proposedCypher !== 'string') {
        return reply.status(400).send({ error: 'Missing required field: proposal', statusCode: 400 });
      }

      const actualSnapshot = await buildGraphSnapshot('live');
      const normalizedProposal: GraphRefinementProposal = {
        summary: normalizeResponseText(proposal.summary ?? ''),
        proposedCypher: stripMarkdownFence(proposal.proposedCypher),
        previewDiff: Array.isArray(proposal.previewDiff) ? proposal.previewDiff : [],
        requiresApproval: Boolean(proposal.requiresApproval),
        rationale: typeof proposal.rationale === 'string' ? normalizeResponseText(proposal.rationale) : undefined,
      };

      const mutation = normalizedProposal.proposedCypher.toUpperCase();
      if (!isGraphMutation(mutation)) {
        return reply.status(400).send({
          error: 'Graph refinement proposals must contain a Cypher mutation (CREATE, MERGE, SET, REMOVE, DELETE, or DETACH DELETE).',
          statusCode: 400,
        });
      }

      const previewError = validatePreviewDiff(normalizedProposal, actualSnapshot);
      if (previewError) {
        return reply.status(400).send({ error: previewError, statusCode: 400 });
      }

      const destructive = isDestructiveMutation(mutation);
      const requiresApproval = destructive || normalizedProposal.requiresApproval;
      const confirmed = body.confirmed === true;

      if (requiresApproval && !confirmed) {
        return reply.status(202).send({
          applied: false,
          preview: normalizedProposal,
          message: 'Confirmation required before applying this graph refinement.',
        } satisfies GraphRefinementResponse);
      }

      try {
        const result = await graphEngine.executeCypher(normalizedProposal.proposedCypher, {}, 'write');
        const summary = buildPreviewChangeCount(normalizedProposal.previewDiff);
        return reply.send({
          applied: true,
          preview: normalizedProposal,
          result: {
            affectedNodes: summary.affectedNodes,
            affectedRelationships: summary.affectedRelationships,
          },
          message: `Applied graph refinement (${result.rowCount} row${result.rowCount === 1 ? '' : 's'} touched).`,
        } satisfies GraphRefinementResponse);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to apply graph refinement';
        return reply.status(400).send({
          applied: false,
          preview: normalizedProposal,
          message,
        } satisfies GraphRefinementResponse);
      }
    }
  );
}

export { buildGraphSnapshot };
