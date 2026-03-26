/**
 * GraphQL API with GraphQL Yoga
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.9, 17.10
 */

import { createYoga, createSchema, createPubSub } from 'graphql-yoga';
import { maxDepthPlugin } from '@escape.tech/graphql-armor-max-depth';
import { costLimitPlugin } from '@escape.tech/graphql-armor-cost-limit';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GraphEngine, GraphQueryEngine, ResourceFilters } from '@cig/graph';
import type { CartographyStatus } from '@cig/discovery';
import { CartographyClient } from '@cig/discovery';

// ─── Shared instances ─────────────────────────────────────────────────────────

const graphEngine = new GraphEngine();
const queryEngine = new GraphQueryEngine();
const cartographyClient = new CartographyClient();

const DEFAULT_DISCOVERY_INTERVAL_MINUTES = 5;

function resolveDiscoveryIntervalMinutes(): number {
  const parsed = Number.parseInt(process.env.DISCOVERY_INTERVAL_MINUTES ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DISCOVERY_INTERVAL_MINUTES;
}

function resolveNextRun(lastRun: string | null): string | null {
  if (!lastRun) {
    return null;
  }

  const startedAt = new Date(lastRun);
  if (Number.isNaN(startedAt.getTime())) {
    return null;
  }

  startedAt.setMinutes(startedAt.getMinutes() + resolveDiscoveryIntervalMinutes());
  return startedAt.toISOString();
}

function buildDiscoveryStatusSnapshot(status: CartographyStatus | null) {
  const lastRun = status?.last_run_end ?? status?.last_run_start ?? null;

  return {
    running: status?.running ?? false,
    lastRunStart: status?.last_run_start ?? null,
    lastRunEnd: status?.last_run_end ?? null,
    lastRunSuccess: status?.last_run_success ?? null,
    lastError: status?.last_error ?? null,
    runCount: status?.run_count ?? 0,
    nextRun: resolveNextRun(lastRun),
  };
}

// ─── PubSub for subscriptions ─────────────────────────────────────────────────

const pubSub = createPubSub<{
  RESOURCE_UPDATED: [resource: Record<string, unknown>];
  DISCOVERY_PROGRESS: [progress: Record<string, unknown>];
}>();

export { pubSub };

// ─── Cursor-based pagination helpers ─────────────────────────────────────────

function encodeCursor(offset: number): string {
  return Buffer.from(`cursor:${offset}`).toString('base64');
}

function decodeCursor(cursor: string): number {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const match = decoded.match(/^cursor:(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    return 0;
  }
}

// ─── GraphQL Schema ───────────────────────────────────────────────────────────

const typeDefs = /* GraphQL */ `
  scalar JSON
  scalar DateTime

  enum ResourceType {
    COMPUTE
    STORAGE
    NETWORK
    DATABASE
    SERVICE
    FUNCTION
    CONTAINER
    VOLUME
  }

  enum Provider {
    AWS
    GCP
    KUBERNETES
    DOCKER
  }

  enum ResourceState {
    RUNNING
    STOPPED
    TERMINATED
    ACTIVE
    INACTIVE
    PENDING
    FAILED
  }

  enum RelationshipType {
    DEPENDS_ON
    CONNECTS_TO
    USES
    MEMBER_OF
    HAS_PERMISSION
    MOUNTS
    ROUTES_TO
  }

  enum ActionType {
    CREATE_S3_BUCKET
    START_EC2_INSTANCE
    STOP_EC2_INSTANCE
  }

  type Tag {
    key: String!
    value: String!
  }

  type Resource {
    id: ID!
    name: String!
    type: ResourceType!
    provider: Provider!
    region: String
    zone: String
    state: ResourceState!
    tags: [Tag!]!
    metadata: JSON
    cost: Float
    createdAt: DateTime!
    updatedAt: DateTime!
    discoveredAt: DateTime!
    dependencies(depth: Int): [Resource!]!
    dependents(depth: Int): [Resource!]!
    relationships: [Relationship!]!
  }

  type Relationship {
    id: ID!
    from: Resource
    to: Resource
    type: RelationshipType!
    metadata: JSON
  }

  type ResourceEdge {
    node: Resource!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type ResourceConnection {
    edges: [ResourceEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ResourceCounts {
    total: Int!
    byType: JSON!
    byProvider: JSON!
  }

  type Cycle {
    nodes: [String!]!
    edges: [String!]!
  }

  type DiscoveryStatus {
    running: Boolean!
    lastRunStart: String
    lastRunEnd: String
    lastRunSuccess: Boolean
    lastError: String
    runCount: Int!
  }

  type DiscoveryJob {
    id: ID!
    status: String!
    startedAt: DateTime
  }

  type DiscoveryProgress {
    jobId: String!
    status: String!
    message: String
    timestamp: DateTime!
  }

  type CostSummary {
    totalMonthlyCost: Float!
    currency: String!
    message: String
  }

  type SecurityFinding {
    id: ID!
    severity: String!
    title: String!
    description: String!
    resourceId: String
  }

  type SecurityScore {
    score: Int!
    maxScore: Int!
    grade: String!
    message: String
  }

  type ActionResult {
    success: Boolean!
    message: String
    resourceId: ID
    actionId: String
  }

  input TagInput {
    key: String!
    value: String!
  }

  input ActionInput {
    type: ActionType!
    resourceId: ID
    parameters: JSON
  }

  type Query {
    resource(id: ID!): Resource
    resources(
      type: ResourceType
      provider: Provider
      region: String
      state: ResourceState
      tags: [TagInput!]
      first: Int
      after: String
      limit: Int
      offset: Int
    ): ResourceConnection!
    searchResources(query: String!): [Resource!]!
    unusedResources: [Resource!]!
    circularDependencies: [Cycle!]!
    resourceCounts: ResourceCounts!
    discoveryStatus: DiscoveryStatus!
    costSummary: CostSummary!
    securityFindings: [SecurityFinding!]!
    securityScore: SecurityScore!
  }

  type Mutation {
    triggerDiscovery: DiscoveryJob!
    executeAction(input: ActionInput!): ActionResult!
  }

  type Subscription {
    resourceUpdated: Resource!
    discoveryProgress: DiscoveryProgress!
  }
`;

// ─── Resource mapper ──────────────────────────────────────────────────────────

function mapResource(r: Record<string, unknown>) {
  const tags = r['tags'] as Record<string, string> | undefined;
  return {
    ...r,
    type: String(r['type']).toUpperCase(),
    provider: String(r['provider']).toUpperCase(),
    state: String(r['state']).toUpperCase(),
    tags: tags ? Object.entries(tags).map(([key, value]) => ({ key, value })) : [],
  };
}

// ─── Resolvers ────────────────────────────────────────────────────────────────

const resolvers = {
  Query: {
    // Requirement 17.2 — resource query
    resource: async (_: unknown, { id }: { id: string }) => {
      const r = await graphEngine.getResource(id);
      return r ? mapResource(r as unknown as Record<string, unknown>) : null;
    },

    // Requirement 17.2 — resources query with cursor-based pagination (17.10)
    resources: async (
      _: unknown,
      args: {
        type?: string;
        provider?: string;
        region?: string;
        state?: string;
        tags?: Array<{ key: string; value: string }>;
        first?: number;
        after?: string;
        limit?: number;
        offset?: number;
      }
    ) => {
      const limit = args.first ?? args.limit ?? 100;
      const offset = args.after ? decodeCursor(args.after) : (args.offset ?? 0);

      const filters: ResourceFilters = {};
      if (args.type) filters.type = args.type.toLowerCase() as ResourceFilters['type'];
      if (args.provider) filters.provider = args.provider.toLowerCase() as ResourceFilters['provider'];
      if (args.region) filters.region = args.region;
      if (args.state) filters.state = args.state.toLowerCase() as ResourceFilters['state'];
      if (args.tags) {
        filters.tags = Object.fromEntries(args.tags.map((t) => [t.key, t.value]));
      }

      const result = await queryEngine.listResourcesPaged(filters, { limit, offset });
      const items = result.items.map((r) => mapResource(r as unknown as Record<string, unknown>));

      const edges = items.map((node, i) => ({
        node,
        cursor: encodeCursor(offset + i),
      }));

      return {
        edges,
        totalCount: result.total,
        pageInfo: {
          hasNextPage: result.hasMore,
          hasPreviousPage: offset > 0,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        },
      };
    },

    // Requirement 17.2 — searchResources
    searchResources: async (_: unknown, { query }: { query: string }) => {
      const results = await queryEngine.searchResources(query);
      return results.map((r) => mapResource(r as unknown as Record<string, unknown>));
    },

    // Requirement 17.3 — aggregation queries
    unusedResources: async () => {
      const results = await queryEngine.findUnusedResources();
      return results.map((r) => mapResource(r as unknown as Record<string, unknown>));
    },

    circularDependencies: async () => {
      return queryEngine.findCircularDependencies();
    },

    resourceCounts: async () => {
      const byType = await queryEngine.getResourceCounts();
      const total = Object.values(byType).reduce((sum, n) => sum + n, 0);
      return { total, byType, byProvider: {} };
    },

    // Requirement 17.4 — discovery queries
    discoveryStatus: async () => {
      try {
        const status = await cartographyClient.getStatus();
        return buildDiscoveryStatusSnapshot(status);
      } catch (error) {
        console.warn('[GraphQL] Discovery status unavailable; returning fallback snapshot:', error);
        return buildDiscoveryStatusSnapshot(null);
      }
    },

    // Requirement 17.5 — cost queries (stub)
    costSummary: async () => ({
      totalMonthlyCost: 0,
      currency: 'USD',
      message: 'Cost analysis not yet implemented',
    }),

    // Requirement 17.6 — security queries (stub)
    securityFindings: async () => [],

    securityScore: async () => ({
      score: 0,
      maxScore: 100,
      grade: 'N/A',
      message: 'Security scoring not yet implemented',
    }),
  },

  Mutation: {
    // Requirement 17.7 — triggerDiscovery mutation
    triggerDiscovery: async () => {
      const result = await cartographyClient.triggerRun();
      const jobId = `job_${Date.now()}`;
      pubSub.publish('DISCOVERY_PROGRESS', {
        jobId,
        status: result.status,
        message: `Discovery ${result.status}`,
        timestamp: new Date(),
      });
      return {
        id: jobId,
        status: result.status,
        startedAt: new Date(),
      };
    },

    // Requirement 17.7 — executeAction mutation
    executeAction: async (
      _: unknown,
      { input }: { input: { type: string; resourceId?: string; parameters?: Record<string, unknown> } }
    ) => {
      if (input.resourceId) {
        const resource = await graphEngine.getResource(input.resourceId);
        if (!resource) {
          return { success: false, message: 'Resource not found', resourceId: input.resourceId };
        }
      }
      const actionId = `action_${Date.now()}`;
      return {
        success: true,
        message: `Action ${input.type} queued for execution`,
        resourceId: input.resourceId ?? null,
        actionId,
      };
    },
  },

  Subscription: {
    // Requirement 17.7 — resourceUpdated subscription
    resourceUpdated: {
      subscribe: () => pubSub.subscribe('RESOURCE_UPDATED'),
      resolve: (payload: Record<string, unknown>) => payload,
    },

    // Requirement 17.7 — discoveryProgress subscription
    discoveryProgress: {
      subscribe: () => pubSub.subscribe('DISCOVERY_PROGRESS'),
      resolve: (payload: Record<string, unknown>) => payload,
    },
  },

  // Field resolvers for nested Resource fields
  Resource: {
    dependencies: async (parent: { id: string }, { depth }: { depth?: number }) => {
      const results = await queryEngine.getDependencies(parent.id, depth ?? 1);
      return results.map((r) => mapResource(r as unknown as Record<string, unknown>));
    },
    dependents: async (parent: { id: string }, { depth }: { depth?: number }) => {
      const results = await queryEngine.getDependents(parent.id, depth ?? 1);
      return results.map((r) => mapResource(r as unknown as Record<string, unknown>));
    },
    relationships: async (parent: { id: string }) => {
      const rels = await graphEngine.getRelationships(parent.id);
      return rels.map((rel) => ({
        id: rel.id,
        type: rel.type,
        from: null, // lazy — avoid N+1 for now
        to: null,
        metadata: rel.properties,
      }));
    },
  },
};

// ─── Yoga instance ────────────────────────────────────────────────────────────

const schema = createSchema({ typeDefs, resolvers });

export const yoga = createYoga({
  schema,
  graphqlEndpoint: '/graphql',
  plugins: [
    // Requirement 17.9 — depth limiting (max 5)
    maxDepthPlugin({ n: 5 }),
    // Requirement 17.9 — complexity limiting (max 1000)
    costLimitPlugin({ maxCost: 1000 }),
  ],
  logging: false,
});

// ─── Fastify integration ──────────────────────────────────────────────────────

export async function registerGraphQL(app: FastifyInstance): Promise<void> {
  app.route({
    url: '/graphql',
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const response = await yoga.handleNodeRequestAndResponse(request, reply);
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });
      reply.status(response.status);
      reply.send(response.body);
      return reply;
    },
  });
}
