import crypto from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import {
  GraphEngine,
  GraphQueryEngine,
  Provider,
  RelationshipType,
  ResourceState,
  ResourceType,
  type Relationship as GraphRelationship,
  type Resource_Model,
} from '@cig/graph';
import { query } from './db/client';
import { DEMO_GRAPH_SCOPE } from './graph-scope';
import {
  getDemoSemanticScope,
  resolveSemanticCollectionName,
  syncSemanticIndex,
} from './semantic-rag';
import type { GraphDiscoverySnapshot, GraphSnapshot, Relationship } from '@cig/sdk';

export interface DemoWorkspaceStateRow {
  source: 'demo';
  seed_version: string;
  seeded_at: string;
  seeded_by: string;
  resource_count: number;
  relationship_count: number;
  semantic_collection: string;
  updated_at: string;
}

export interface DemoWorkspaceStatus {
  source: 'demo';
  seedVersion: string;
  seededAt: string;
  seededBy: string;
  resourceCount: number;
  relationshipCount: number;
  semanticCollection: string;
  updatedAt: string;
}

export interface ProvisionDemoWorkspaceOptions {
  force?: boolean;
  seededBy?: string;
  logger?: Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>;
}

const graphEngine = new GraphEngine();
const queryEngine = new GraphQueryEngine();

export const DEMO_WORKSPACE_SOURCE = 'demo' as const;
export const DEMO_WORKSPACE_SEED_VERSION = '2026-03-27.1';
const DEFAULT_SEEDED_BY = 'system';

function nowIso(): string {
  return new Date().toISOString();
}

function makeResource(resource: Omit<Resource_Model, 'createdAt' | 'updatedAt' | 'discoveredAt'>): Resource_Model {
  const now = new Date();
  return {
    ...resource,
    createdAt: now,
    updatedAt: now,
    discoveredAt: now,
  };
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function resourceTag(domain: string, role: string): Record<string, string> {
  return {
    demo: 'true',
    domain,
    role,
  };
}

function mapResource(resource: Resource_Model) {
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

function mapGraphRelationship(relationship: GraphRelationship): Relationship {
  return {
    sourceId: relationship.fromId,
    targetId: relationship.toId,
    type: String(relationship.type),
  };
}

function mapSeedRelationship(relationship: { from: string; to: string; type: RelationshipType | string }): Relationship {
  return {
    sourceId: relationship.from,
    targetId: relationship.to,
    type: String(relationship.type),
  };
}

function summarizeResourceCounts(resources: Resource_Model[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const resource of resources) {
    const key = String(resource.type);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

const DEMO_RESOURCES: Resource_Model[] = [
  makeResource({
    id: 'demo-platform-gateway',
    name: 'Demo Platform Gateway',
    type: ResourceType.SERVICE,
    provider: Provider.AWS,
    region: 'us-east-1',
    state: ResourceState.RUNNING,
    tags: resourceTag('platform', 'gateway'),
    metadata: {
      description: 'Entry point for the shared demo workspace',
      public: true,
    },
    cost: 38.5,
    ownerId: DEMO_GRAPH_SCOPE.ownerId,
    tenant: DEMO_GRAPH_SCOPE.tenant,
    workspace: DEMO_GRAPH_SCOPE.workspace,
  }),
  makeResource({
    id: 'demo-ventas-api',
    name: 'Demo Ventas API',
    type: ResourceType.SERVICE,
    provider: Provider.AWS,
    region: 'us-east-1',
    state: ResourceState.RUNNING,
    tags: resourceTag('sales', 'api'),
    metadata: {
      description: 'Core sales API used by the demo chat and graph views',
      tier: 'gold',
    },
    cost: 92.1,
    ownerId: DEMO_GRAPH_SCOPE.ownerId,
    tenant: DEMO_GRAPH_SCOPE.tenant,
    workspace: DEMO_GRAPH_SCOPE.workspace,
  }),
  makeResource({
    id: 'demo-clientes-db',
    name: 'Demo Clientes DB',
    type: ResourceType.DATABASE,
    provider: Provider.AWS,
    region: 'us-east-1',
    state: ResourceState.ACTIVE,
    tags: resourceTag('sales', 'database'),
    metadata: {
      engine: 'postgres',
      pii: true,
    },
    cost: 64.8,
    ownerId: DEMO_GRAPH_SCOPE.ownerId,
    tenant: DEMO_GRAPH_SCOPE.tenant,
    workspace: DEMO_GRAPH_SCOPE.workspace,
  }),
  makeResource({
    id: 'demo-cache',
    name: 'Demo Cache Cluster',
    type: ResourceType.DATABASE,
    provider: Provider.AWS,
    region: 'us-east-1',
    state: ResourceState.ACTIVE,
    tags: resourceTag('sales', 'cache'),
    metadata: {
      engine: 'redis',
      ttlSeconds: 300,
    },
    cost: 21.4,
    ownerId: DEMO_GRAPH_SCOPE.ownerId,
    tenant: DEMO_GRAPH_SCOPE.tenant,
    workspace: DEMO_GRAPH_SCOPE.workspace,
  }),
  makeResource({
    id: 'demo-productos-store',
    name: 'Demo Productos Store',
    type: ResourceType.STORAGE,
    provider: Provider.GCP,
    region: 'multi-region',
    state: ResourceState.ACTIVE,
    tags: resourceTag('catalog', 'storage'),
    metadata: {
      bucketClass: 'standard',
      versioning: true,
    },
    cost: 17.6,
    ownerId: DEMO_GRAPH_SCOPE.ownerId,
    tenant: DEMO_GRAPH_SCOPE.tenant,
    workspace: DEMO_GRAPH_SCOPE.workspace,
  }),
  makeResource({
    id: 'demo-creditos-fn',
    name: 'Demo Creditos Function',
    type: ResourceType.FUNCTION,
    provider: Provider.GCP,
    region: 'us-central1',
    state: ResourceState.ACTIVE,
    tags: resourceTag('finance', 'function'),
    metadata: {
      runtime: 'nodejs22',
      triggers: ['pubsub', 'http'],
    },
    cost: 11.2,
    ownerId: DEMO_GRAPH_SCOPE.ownerId,
    tenant: DEMO_GRAPH_SCOPE.tenant,
    workspace: DEMO_GRAPH_SCOPE.workspace,
  }),
  makeResource({
    id: 'demo-campanas-fn',
    name: 'Demo Campanas Function',
    type: ResourceType.FUNCTION,
    provider: Provider.AWS,
    region: 'us-west-2',
    state: ResourceState.ACTIVE,
    tags: resourceTag('marketing', 'function'),
    metadata: {
      runtime: 'python3.12',
      triggers: ['schedule', 'eventbridge'],
    },
    cost: 9.4,
    ownerId: DEMO_GRAPH_SCOPE.ownerId,
    tenant: DEMO_GRAPH_SCOPE.tenant,
    workspace: DEMO_GRAPH_SCOPE.workspace,
  }),
  makeResource({
    id: 'demo-reporting-app',
    name: 'Demo Reporting App',
    type: ResourceType.CONTAINER,
    provider: Provider.KUBERNETES,
    region: 'us-east-1',
    state: ResourceState.RUNNING,
    tags: resourceTag('analytics', 'container'),
    metadata: {
      namespace: 'demo-analytics',
      replicas: 2,
    },
    cost: 25.9,
    ownerId: DEMO_GRAPH_SCOPE.ownerId,
    tenant: DEMO_GRAPH_SCOPE.tenant,
    workspace: DEMO_GRAPH_SCOPE.workspace,
  }),
  makeResource({
    id: 'demo-shared-vpc',
    name: 'Demo Shared VPC',
    type: ResourceType.NETWORK,
    provider: Provider.AWS,
    region: 'us-east-1',
    state: ResourceState.ACTIVE,
    tags: resourceTag('platform', 'network'),
    metadata: {
      cidr: '10.32.0.0/16',
      shared: true,
    },
    cost: 5.2,
    ownerId: DEMO_GRAPH_SCOPE.ownerId,
    tenant: DEMO_GRAPH_SCOPE.tenant,
    workspace: DEMO_GRAPH_SCOPE.workspace,
  }),
];

const DEMO_RELATIONSHIPS = [
  { from: 'demo-platform-gateway', to: 'demo-ventas-api', type: RelationshipType.ROUTES_TO, properties: { latency: '4ms' } },
  { from: 'demo-ventas-api', to: 'demo-clientes-db', type: RelationshipType.DEPENDS_ON, properties: { latency: '8ms' } },
  { from: 'demo-ventas-api', to: 'demo-cache', type: RelationshipType.USES, properties: { purpose: 'hot-cache' } },
  { from: 'demo-ventas-api', to: 'demo-productos-store', type: RelationshipType.CONNECTS_TO, properties: { purpose: 'catalog-sync' } },
  { from: 'demo-creditos-fn', to: 'demo-ventas-api', type: RelationshipType.DEPENDS_ON, properties: { trigger: 'payment-complete' } },
  { from: 'demo-campanas-fn', to: 'demo-ventas-api', type: RelationshipType.CONNECTS_TO, properties: { trigger: 'campaign-rule' } },
  { from: 'demo-reporting-app', to: 'demo-ventas-api', type: RelationshipType.USES, properties: { dashboard: 'sales-overview' } },
  { from: 'demo-reporting-app', to: 'demo-productos-store', type: RelationshipType.USES, properties: { dashboard: 'catalog-insights' } },
  { from: 'demo-shared-vpc', to: 'demo-ventas-api', type: RelationshipType.CONNECTS_TO, properties: { network: 'private-link' } },
] as const;

function buildDemoDiscoverySnapshot(status: DemoWorkspaceStatus | null): GraphDiscoverySnapshot {
  const lastRun = status?.updatedAt ?? status?.seededAt ?? null;

  return {
    healthy: true,
    running: false,
    lastRun,
    nextRun: null,
  };
}

function buildStatusRow(row: DemoWorkspaceStateRow): DemoWorkspaceStatus {
  return {
    source: row.source,
    seedVersion: row.seed_version,
    seededAt: row.seeded_at,
    seededBy: row.seeded_by,
    resourceCount: toNumber(row.resource_count),
    relationshipCount: toNumber(row.relationship_count),
    semanticCollection: row.semantic_collection,
    updatedAt: row.updated_at,
  };
}

function semanticCollectionName(): string {
  return resolveSemanticCollectionName(getDemoSemanticScope());
}

async function readStateRow(): Promise<DemoWorkspaceStateRow | null> {
  try {
    const result = await query<DemoWorkspaceStateRow>(
      `SELECT source, seed_version, seeded_at, seeded_by, resource_count, relationship_count, semantic_collection, updated_at
         FROM demo_workspace_state
        WHERE source = ?
        LIMIT 1`,
      [DEMO_WORKSPACE_SOURCE]
    );

    return result.rows[0] ?? null;
  } catch {
    return null;
  }
}

async function loadDemoWorkspaceGraphData(): Promise<{
  resourceCounts: Record<string, number>;
  resources: Resource_Model[];
  relationships: Relationship[];
}> {
  const [resourceCountsResult, resourcesResult, relationshipsResult] = await Promise.allSettled([
    queryEngine.getResourceCounts(DEMO_GRAPH_SCOPE),
    queryEngine.listResourcesPaged(undefined, { limit: 1_000 }, DEMO_GRAPH_SCOPE),
    queryEngine.listRelationships(1_000, DEMO_GRAPH_SCOPE),
  ]);

  const resources =
    resourcesResult.status === 'fulfilled' && resourcesResult.value.items.length > 0
      ? resourcesResult.value.items
      : DEMO_RESOURCES;

  const relationships =
    relationshipsResult.status === 'fulfilled' && relationshipsResult.value.length > 0
      ? relationshipsResult.value.map(mapGraphRelationship)
      : DEMO_RELATIONSHIPS.map(mapSeedRelationship);

  const resourceCounts =
    resourceCountsResult.status === 'fulfilled' && Object.keys(resourceCountsResult.value).length > 0
      ? resourceCountsResult.value
      : summarizeResourceCounts(resources);

  return {
    resourceCounts,
    resources,
    relationships,
  };
}

async function writeStateRow(row: Omit<DemoWorkspaceStateRow, 'source'> & { source?: 'demo' }): Promise<DemoWorkspaceStatus> {
  const payload: DemoWorkspaceStateRow = {
    source: DEMO_WORKSPACE_SOURCE,
    ...row,
  };

  await query(
    `INSERT INTO demo_workspace_state (
       source, seed_version, seeded_at, seeded_by, resource_count, relationship_count, semantic_collection, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(source) DO UPDATE SET
       seed_version = excluded.seed_version,
       seeded_at = excluded.seeded_at,
       seeded_by = excluded.seeded_by,
       resource_count = excluded.resource_count,
       relationship_count = excluded.relationship_count,
       semantic_collection = excluded.semantic_collection,
       updated_at = excluded.updated_at`,
    [
      payload.source,
      payload.seed_version,
      payload.seeded_at,
      payload.seeded_by,
      payload.resource_count,
      payload.relationship_count,
      payload.semantic_collection,
      payload.updated_at,
    ]
  );

  return buildStatusRow(payload);
}

async function clearDemoWorkspace(): Promise<number> {
  const resources = (
    await queryEngine.listResourcesPaged(undefined, { limit: 1_000 }, DEMO_GRAPH_SCOPE)
  ).items;
  for (const resource of resources) {
    await graphEngine.deleteResource(resource.id, DEMO_GRAPH_SCOPE);
  }
  return resources.length;
}

async function seedDemoWorkspace(
  seededBy: string,
  logger?: Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>
): Promise<DemoWorkspaceStatus> {
  const startedAt = nowIso();

  for (const resource of DEMO_RESOURCES) {
    await graphEngine.createResource(resource, DEMO_GRAPH_SCOPE);
  }

  for (const relationship of DEMO_RELATIONSHIPS) {
    await graphEngine.createRelationship(
      relationship.from,
      relationship.to,
      relationship.type,
      relationship.properties,
      DEMO_GRAPH_SCOPE
    );
  }

  const resourceCount = DEMO_RESOURCES.length;
  const relationshipCount = DEMO_RELATIONSHIPS.length;
  const semanticCollection = semanticCollectionName();

  try {
    await syncSemanticIndex(getDemoSemanticScope(), logger);
  } catch (error) {
    logger?.warn?.(
      { err: error },
      'Demo workspace semantic sync failed; graph seed completed without vector refresh'
    );
  }

  return writeStateRow({
    seed_version: DEMO_WORKSPACE_SEED_VERSION,
    seeded_at: startedAt,
    seeded_by: seededBy,
    resource_count: resourceCount,
    relationship_count: relationshipCount,
    semantic_collection: semanticCollection,
    updated_at: nowIso(),
  });
}

export async function getDemoWorkspaceStatus(): Promise<DemoWorkspaceStatus | null> {
  const state = await readStateRow();
  return state ? buildStatusRow(state) : null;
}

export async function provisionDemoWorkspace(
  options: ProvisionDemoWorkspaceOptions = {}
): Promise<DemoWorkspaceStatus> {
  const state = await readStateRow();
  const existingResources = await queryEngine
    .listResourcesPaged(undefined, { limit: 1_000 }, DEMO_GRAPH_SCOPE)
    .then((result) => result.items)
    .catch(() => [] as Resource_Model[]);

  if (
    !options.force &&
    state &&
    state.seed_version === DEMO_WORKSPACE_SEED_VERSION &&
    state.resource_count > 0 &&
    existingResources.length === state.resource_count
  ) {
    return buildStatusRow(state);
  }

  await clearDemoWorkspace();

  return seedDemoWorkspace(options.seededBy?.trim() || DEFAULT_SEEDED_BY, options.logger);
}

export async function ensureDemoWorkspaceProvisioned(
  logger?: Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>
): Promise<DemoWorkspaceStatus> {
  const state = await readStateRow();
  if (state && state.seed_version === DEMO_WORKSPACE_SEED_VERSION && state.resource_count > 0) {
    return buildStatusRow(state);
  }

  return provisionDemoWorkspace({ logger });
}

export async function buildDemoWorkspaceGraphSnapshot(): Promise<GraphSnapshot> {
  const status = await getDemoWorkspaceStatus().catch(() => null);
  try {
    const graphData = await loadDemoWorkspaceGraphData();
    const syncedAt = status?.updatedAt ?? status?.seededAt ?? new Date().toISOString();

    return {
      source: {
        kind: 'demo',
        available: true,
        lastSyncedAt: syncedAt,
      },
      resourceCounts: graphData.resourceCounts,
      resources: graphData.resources.map(mapResource),
      relationships: graphData.relationships,
      discovery: buildDemoDiscoverySnapshot(status),
    };
  } catch {
    const syncedAt = status?.updatedAt ?? status?.seededAt ?? new Date().toISOString();

    return {
      source: {
        kind: 'demo',
        available: true,
        lastSyncedAt: syncedAt,
      },
      resourceCounts: summarizeResourceCounts(DEMO_RESOURCES),
      resources: DEMO_RESOURCES.map(mapResource),
      relationships: DEMO_RELATIONSHIPS.map(mapSeedRelationship),
      discovery: buildDemoDiscoverySnapshot(status),
    };
  }
}
