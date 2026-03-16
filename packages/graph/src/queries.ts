import { Session } from 'neo4j-driver';
import { getReadSession } from './neo4j';
import { Resource_Model, ResourceType, Provider, ResourceState } from './types';
import { ResourceFilters } from './engine';

// ─── Query Types ──────────────────────────────────────────────────────────────

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

export interface Cycle {
  nodes: string[];
  edges: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUERY_TIMEOUT_MS = 30_000;
const MAX_DEPTH = 3;
const DEFAULT_LIMIT = 50;

// ─── Record Mapping ───────────────────────────────────────────────────────────

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return new Date();
}

function recordToResource(record: Record<string, unknown>): Resource_Model {
  return {
    id: record['id'] as string,
    name: record['name'] as string,
    type: record['type'] as ResourceType,
    provider: record['provider'] as Provider,
    region: record['region'] as string | undefined,
    zone: record['zone'] as string | undefined,
    state: record['state'] as ResourceState,
    tags: record['tags'] ? JSON.parse(record['tags'] as string) : {},
    metadata: record['metadata'] ? JSON.parse(record['metadata'] as string) : {},
    cost: record['cost'] != null ? Number(record['cost']) : undefined,
    createdAt: toDate(record['createdAt']),
    updatedAt: toDate(record['updatedAt']),
    discoveredAt: toDate(record['discoveredAt']),
  };
}

// ─── Session Runner ───────────────────────────────────────────────────────────

async function runRead<T>(fn: (session: Session) => Promise<T>): Promise<T> {
  const session = getReadSession();
  try {
    return await fn(session);
  } finally {
    await session.close();
  }
}

// ─── GraphQueryEngine ─────────────────────────────────────────────────────────

export class GraphQueryEngine {
  /**
   * Returns all resources that the given resource depends on, up to `depth` levels.
   * Depth is capped at 3. Requirements: 8.3, 8.4
   */
  async getDependencies(resourceId: string, depth = 1): Promise<Resource_Model[]> {
    const cappedDepth = Math.min(Math.max(1, depth), MAX_DEPTH);
    return runRead(async (session) => {
      const result = await session.run(
        `MATCH (r:Resource {id: $id})-[:DEPENDS_ON|USES|CONNECTS_TO*1..$depth]->(dep:Resource)
         RETURN DISTINCT properties(dep) AS dep`,
        { id: resourceId, depth: cappedDepth },
        { timeout: QUERY_TIMEOUT_MS }
      );
      return result.records.map((rec) =>
        recordToResource(rec.get('dep') as Record<string, unknown>)
      );
    });
  }

  /**
   * Returns all resources that depend on the given resource, up to `depth` levels.
   * Requirements: 8.5
   */
  async getDependents(resourceId: string, depth = 1): Promise<Resource_Model[]> {
    const cappedDepth = Math.min(Math.max(1, depth), MAX_DEPTH);
    return runRead(async (session) => {
      const result = await session.run(
        `MATCH (dep:Resource)-[:DEPENDS_ON|USES|CONNECTS_TO*1..$depth]->(r:Resource {id: $id})
         RETURN DISTINCT properties(dep) AS dep`,
        { id: resourceId, depth: cappedDepth },
        { timeout: QUERY_TIMEOUT_MS }
      );
      return result.records.map((rec) =>
        recordToResource(rec.get('dep') as Record<string, unknown>)
      );
    });
  }

  /**
   * Returns resources that no other resource depends on (leaf/orphan resources).
   * Requirements: 8.6
   */
  async findUnusedResources(): Promise<Resource_Model[]> {
    return runRead(async (session) => {
      const result = await session.run(
        `MATCH (r:Resource)
         WHERE NOT ()-[:DEPENDS_ON|USES|CONNECTS_TO]->(r)
         RETURN properties(r) AS r`,
        {},
        { timeout: QUERY_TIMEOUT_MS }
      );
      return result.records.map((rec) =>
        recordToResource(rec.get('r') as Record<string, unknown>)
      );
    });
  }

  /**
   * Detects circular dependency cycles in the graph.
   * Uses manual Cypher cycle detection via path matching.
   * Requirements: 8.7
   */
  async findCircularDependencies(): Promise<Cycle[]> {
    return runRead(async (session) => {
      // Try APOC SCC first, fall back to manual Cypher detection
      try {
        const result = await session.run(
          `CALL apoc.algo.scc() YIELD nodes
           WHERE size(nodes) > 1
           RETURN [n IN nodes | n.id] AS nodeIds`,
          {},
          { timeout: QUERY_TIMEOUT_MS }
        );
        return result.records.map((rec) => {
          const nodeIds = rec.get('nodeIds') as string[];
          return {
            nodes: nodeIds,
            edges: [],
          };
        });
      } catch {
        // APOC not available — use manual Cypher cycle detection
        const result = await session.run(
          `MATCH path = (r:Resource)-[:DEPENDS_ON|USES|CONNECTS_TO*2..${MAX_DEPTH}]->(r)
           RETURN [n IN nodes(path) | n.id] AS nodeIds,
                  [rel IN relationships(path) | type(rel)] AS edgeTypes`,
          {},
          { timeout: QUERY_TIMEOUT_MS }
        );

        const seen = new Set<string>();
        const cycles: Cycle[] = [];

        for (const rec of result.records) {
          const nodeIds = rec.get('nodeIds') as string[];
          const edgeTypes = rec.get('edgeTypes') as string[];
          const key = [...nodeIds].sort().join(',');
          if (!seen.has(key)) {
            seen.add(key);
            cycles.push({ nodes: nodeIds, edges: edgeTypes });
          }
        }

        return cycles;
      }
    });
  }

  /**
   * Full-text search across resource names and metadata.
   * Requirements: 8.8
   */
  async searchResources(query: string): Promise<Resource_Model[]> {
    return runRead(async (session) => {
      const result = await session.run(
        `CALL db.index.fulltext.queryNodes('resource_search', $query) YIELD node
         RETURN properties(node) AS r`,
        { query },
        { timeout: QUERY_TIMEOUT_MS }
      );
      return result.records.map((rec) =>
        recordToResource(rec.get('r') as Record<string, unknown>)
      );
    });
  }

  /**
   * Lists resources with optional filters and pagination.
   * Requirements: 8.9, 8.10, 24.8
   */
  async listResourcesPaged(
    filters?: ResourceFilters,
    pagination?: PaginationOptions
  ): Promise<PagedResult<Resource_Model>> {
    const limit = pagination?.limit ?? DEFAULT_LIMIT;
    const offset = pagination?.offset ?? 0;

    return runRead(async (session) => {
      const conditions: string[] = [];
      const params: Record<string, unknown> = { limit, offset };

      if (filters?.type) { conditions.push('r.type = $type'); params['type'] = filters.type; }
      if (filters?.provider) { conditions.push('r.provider = $provider'); params['provider'] = filters.provider; }
      if (filters?.region) { conditions.push('r.region = $region'); params['region'] = filters.region; }
      if (filters?.state) { conditions.push('r.state = $state'); params['state'] = filters.state; }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Run count and data queries in parallel
      const [countResult, dataResult] = await Promise.all([
        session.run(
          `MATCH (r:Resource) ${where} RETURN count(r) AS total`,
          params,
          { timeout: QUERY_TIMEOUT_MS }
        ),
        session.run(
          `MATCH (r:Resource) ${where} RETURN properties(r) AS r ORDER BY r.name SKIP $offset LIMIT $limit`,
          params,
          { timeout: QUERY_TIMEOUT_MS }
        ),
      ]);

      const total = (countResult.records[0]?.get('total') as { toNumber?: () => number } | number | undefined);
      const totalCount = typeof total === 'object' && total !== null && 'toNumber' in total
        ? (total as { toNumber: () => number }).toNumber()
        : Number(total ?? 0);

      let resources = dataResult.records.map((rec) =>
        recordToResource(rec.get('r') as Record<string, unknown>)
      );

      // Tag filtering done in-memory (tags stored as JSON string)
      if (filters?.tags) {
        const tagEntries = Object.entries(filters.tags);
        resources = resources.filter((res) =>
          tagEntries.every(([k, v]) => res.tags[k] === v)
        );
      }

      return {
        items: resources,
        total: totalCount,
        hasMore: offset + resources.length < totalCount,
      };
    });
  }

  /**
   * Returns resource counts grouped by type.
   * Requirements: 8.9
   */
  async getResourceCounts(): Promise<Record<string, number>> {
    return runRead(async (session) => {
      const result = await session.run(
        `MATCH (r:Resource) RETURN r.type AS type, count(r) AS count`,
        {},
        { timeout: QUERY_TIMEOUT_MS }
      );
      const counts: Record<string, number> = {};
      for (const rec of result.records) {
        const type = rec.get('type') as string;
        const count = rec.get('count') as { toNumber?: () => number } | number;
        counts[type] = typeof count === 'object' && count !== null && 'toNumber' in count
          ? (count as { toNumber: () => number }).toNumber()
          : Number(count);
      }
      return counts;
    });
  }
}
