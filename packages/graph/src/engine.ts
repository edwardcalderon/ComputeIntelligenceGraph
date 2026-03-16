import { Session } from 'neo4j-driver';
import { getReadSession, getWriteSession } from './neo4j';
import { Resource_Model, Relationship, RelationshipType, ResourceType, Provider, ResourceState } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResourceFilters {
  type?: ResourceType;
  provider?: Provider;
  region?: string;
  state?: ResourceState;
  tags?: Record<string, string>;
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

const FAILURE_THRESHOLD = 5;
const RECOVERY_TIMEOUT_MS = 30_000;

class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;

  isOpen(): boolean {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= RECOVERY_TIMEOUT_MS) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= FAILURE_THRESHOLD) {
      this.state = 'OPEN';
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

// ─── Retry Logic ──────────────────────────────────────────────────────────────

const TRANSIENT_ERRORS = ['ServiceUnavailable', 'SessionExpired'];
const RETRY_DELAYS_MS = [100, 200, 400];

function isTransient(err: unknown): boolean {
  if (err instanceof Error) {
    return TRANSIENT_ERRORS.some(
      (code) => err.message.includes(code) || (err as { code?: string }).code === code
    );
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isTransient(err) || attempt === RETRY_DELAYS_MS.length) {
        throw err;
      }
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

// ─── Record Mapping ───────────────────────────────────────────────────────────

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return new Date();
}

function recordToResource(record: Record<string, unknown>): Resource_Model {
  const r = record as Record<string, unknown>;
  return {
    id: r['id'] as string,
    name: r['name'] as string,
    type: r['type'] as ResourceType,
    provider: r['provider'] as Provider,
    region: r['region'] as string | undefined,
    zone: r['zone'] as string | undefined,
    state: r['state'] as ResourceState,
    tags: r['tags'] ? JSON.parse(r['tags'] as string) : {},
    metadata: r['metadata'] ? JSON.parse(r['metadata'] as string) : {},
    cost: r['cost'] != null ? Number(r['cost']) : undefined,
    createdAt: toDate(r['createdAt']),
    updatedAt: toDate(r['updatedAt']),
    discoveredAt: toDate(r['discoveredAt']),
  };
}

function recordToRelationship(record: Record<string, unknown>): Relationship {
  const r = record as Record<string, unknown>;
  return {
    id: r['id'] as string,
    type: r['type'] as RelationshipType,
    fromId: r['fromId'] as string,
    toId: r['toId'] as string,
    properties: r['properties'] ? JSON.parse(r['properties'] as string) : {},
  };
}

// ─── Logger ───────────────────────────────────────────────────────────────────

function log(level: 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>): void {
  const entry = { timestamp: new Date().toISOString(), level, message, ...context };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// ─── GraphEngine ──────────────────────────────────────────────────────────────

export class GraphEngine {
  private readonly circuitBreaker = new CircuitBreaker();

  private async runWrite<T>(fn: (session: Session) => Promise<T>): Promise<T> {
    if (this.circuitBreaker.isOpen()) {
      throw new Error(`GraphEngine circuit breaker is OPEN — database unavailable`);
    }
    const session = getWriteSession();
    try {
      const result = await withRetry(() => fn(session));
      this.circuitBreaker.recordSuccess();
      return result;
    } catch (err) {
      this.circuitBreaker.recordFailure();
      log('error', 'Write operation failed', {
        error: err instanceof Error ? err.message : String(err),
        circuitState: this.circuitBreaker.getState(),
      });
      throw err;
    } finally {
      await session.close();
    }
  }

  private async runRead<T>(fn: (session: Session) => Promise<T>): Promise<T> {
    if (this.circuitBreaker.isOpen()) {
      throw new Error(`GraphEngine circuit breaker is OPEN — database unavailable`);
    }
    const session = getReadSession();
    try {
      const result = await withRetry(() => fn(session));
      this.circuitBreaker.recordSuccess();
      return result;
    } catch (err) {
      this.circuitBreaker.recordFailure();
      log('error', 'Read operation failed', {
        error: err instanceof Error ? err.message : String(err),
        circuitState: this.circuitBreaker.getState(),
      });
      throw err;
    } finally {
      await session.close();
    }
  }

  // ─── Resource CRUD ──────────────────────────────────────────────────────────

  async createResource(resource: Resource_Model): Promise<void> {
    log('info', 'createResource', { id: resource.id, type: resource.type });
    await this.runWrite(async (session) => {
      await session.run(
        `MERGE (r:Resource {id: $id})
         SET r += {
           name: $name,
           type: $type,
           provider: $provider,
           region: $region,
           zone: $zone,
           state: $state,
           tags: $tags,
           metadata: $metadata,
           cost: $cost,
           createdAt: $createdAt,
           updatedAt: $updatedAt,
           discoveredAt: $discoveredAt
         }`,
        {
          id: resource.id,
          name: resource.name,
          type: resource.type,
          provider: resource.provider,
          region: resource.region ?? null,
          zone: resource.zone ?? null,
          state: resource.state,
          tags: JSON.stringify(resource.tags),
          metadata: JSON.stringify(resource.metadata),
          cost: resource.cost ?? null,
          createdAt: resource.createdAt.toISOString(),
          updatedAt: resource.updatedAt.toISOString(),
          discoveredAt: resource.discoveredAt.toISOString(),
        }
      );
    });
  }

  async updateResource(id: string, updates: Partial<Resource_Model>): Promise<void> {
    log('info', 'updateResource', { id });
    const params: Record<string, unknown> = { id, updatedAt: new Date().toISOString() };
    const setClauses: string[] = ['r.updatedAt = $updatedAt'];

    if (updates.name !== undefined) { params['name'] = updates.name; setClauses.push('r.name = $name'); }
    if (updates.type !== undefined) { params['type'] = updates.type; setClauses.push('r.type = $type'); }
    if (updates.provider !== undefined) { params['provider'] = updates.provider; setClauses.push('r.provider = $provider'); }
    if (updates.region !== undefined) { params['region'] = updates.region; setClauses.push('r.region = $region'); }
    if (updates.zone !== undefined) { params['zone'] = updates.zone; setClauses.push('r.zone = $zone'); }
    if (updates.state !== undefined) { params['state'] = updates.state; setClauses.push('r.state = $state'); }
    if (updates.tags !== undefined) { params['tags'] = JSON.stringify(updates.tags); setClauses.push('r.tags = $tags'); }
    if (updates.metadata !== undefined) { params['metadata'] = JSON.stringify(updates.metadata); setClauses.push('r.metadata = $metadata'); }
    if (updates.cost !== undefined) { params['cost'] = updates.cost; setClauses.push('r.cost = $cost'); }

    await this.runWrite(async (session) => {
      await session.run(
        `MATCH (r:Resource {id: $id}) SET ${setClauses.join(', ')}`,
        params
      );
    });
  }

  async deleteResource(id: string): Promise<void> {
    log('info', 'deleteResource', { id });
    await this.runWrite(async (session) => {
      await session.run(
        `MATCH (r:Resource {id: $id}) DETACH DELETE r`,
        { id }
      );
    });
  }

  async getResource(id: string): Promise<Resource_Model | null> {
    return this.runRead(async (session) => {
      const result = await session.run(
        `MATCH (r:Resource {id: $id}) RETURN properties(r) AS r`,
        { id }
      );
      if (result.records.length === 0) return null;
      return recordToResource(result.records[0].get('r') as Record<string, unknown>);
    });
  }

  async listResources(filters?: ResourceFilters): Promise<Resource_Model[]> {
    return this.runRead(async (session) => {
      const conditions: string[] = [];
      const params: Record<string, unknown> = {};

      if (filters?.type) { conditions.push('r.type = $type'); params['type'] = filters.type; }
      if (filters?.provider) { conditions.push('r.provider = $provider'); params['provider'] = filters.provider; }
      if (filters?.region) { conditions.push('r.region = $region'); params['region'] = filters.region; }
      if (filters?.state) { conditions.push('r.state = $state'); params['state'] = filters.state; }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await session.run(
        `MATCH (r:Resource) ${where} RETURN properties(r) AS r`,
        params
      );

      const resources = result.records.map((rec) =>
        recordToResource(rec.get('r') as Record<string, unknown>)
      );

      // Filter by tags in-memory (Neo4j stores tags as JSON string)
      if (filters?.tags) {
        const tagEntries = Object.entries(filters.tags);
        return resources.filter((res) =>
          tagEntries.every(([k, v]) => res.tags[k] === v)
        );
      }

      return resources;
    });
  }

  // ─── Relationship Operations ────────────────────────────────────────────────

  async createRelationship(
    from: string,
    to: string,
    type: RelationshipType,
    props: Record<string, unknown> = {}
  ): Promise<void> {
    log('info', 'createRelationship', { from, to, type });
    const relId = `${from}:${type}:${to}`;
    await this.runWrite(async (session) => {
      await session.run(
        `MATCH (a:Resource {id: $from}), (b:Resource {id: $to})
         MERGE (a)-[rel:${type} {id: $relId}]->(b)
         SET rel.properties = $properties`,
        {
          from,
          to,
          relId,
          properties: JSON.stringify(props),
        }
      );
    });
  }

  async deleteRelationship(from: string, to: string, type: RelationshipType): Promise<void> {
    log('info', 'deleteRelationship', { from, to, type });
    await this.runWrite(async (session) => {
      await session.run(
        `MATCH (a:Resource {id: $from})-[rel:${type}]->(b:Resource {id: $to})
         DELETE rel`,
        { from, to }
      );
    });
  }

  async getRelationships(resourceId: string): Promise<Relationship[]> {
    return this.runRead(async (session) => {
      const result = await session.run(
        `MATCH (a:Resource {id: $id})-[rel]->(b:Resource)
         RETURN rel.id AS id, type(rel) AS type, a.id AS fromId, b.id AS toId, rel.properties AS properties
         UNION
         MATCH (a:Resource)-[rel]->(b:Resource {id: $id})
         RETURN rel.id AS id, type(rel) AS type, a.id AS fromId, b.id AS toId, rel.properties AS properties`,
        { id: resourceId }
      );
      return result.records.map((rec) =>
        recordToRelationship({
          id: rec.get('id') as string,
          type: rec.get('type') as string,
          fromId: rec.get('fromId') as string,
          toId: rec.get('toId') as string,
          properties: rec.get('properties') as string,
        })
      );
    });
  }
}
