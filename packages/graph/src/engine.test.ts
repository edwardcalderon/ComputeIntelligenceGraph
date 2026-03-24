import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphEngine, ResourceFilters } from './engine';
import { GraphQueryEngine } from './queries';
import { ResourceType, Provider, ResourceState, RelationshipType, Resource_Model } from './types';
import * as neo4j from './neo4j';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResource(overrides: Partial<Resource_Model> = {}): Resource_Model {
  const now = new Date('2024-01-01T00:00:00.000Z');
  return {
    id: 'res-1',
    name: 'test-resource',
    type: ResourceType.COMPUTE,
    provider: Provider.AWS,
    region: 'us-east-1',
    state: ResourceState.RUNNING,
    tags: { env: 'prod' },
    metadata: { instanceType: 't3.micro' },
    createdAt: now,
    updatedAt: now,
    discoveredAt: now,
    ...overrides,
  };
}

function makeNeo4jRecord(props: Record<string, unknown>) {
  const now = '2024-01-01T00:00:00.000Z';
  const defaults = {
    id: 'res-1',
    name: 'test',
    type: ResourceType.COMPUTE,
    provider: Provider.AWS,
    region: 'us-east-1',
    state: ResourceState.RUNNING,
    tags: JSON.stringify({ env: 'prod' }),
    metadata: '{}',
    createdAt: now,
    updatedAt: now,
    discoveredAt: now,
    ...props,
  };
  return {
    get: (key: string) => defaults[key as keyof typeof defaults],
  };
}

function makeSession(runResult: Record<string, unknown[]> = {}) {
  const records = (runResult['records'] as unknown[]) ?? [];
  return {
    run: vi.fn().mockResolvedValue({ records }),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── GraphEngine Tests ────────────────────────────────────────────────────────

describe('GraphEngine', () => {
  let engine: GraphEngine;
  let mockWriteSession: ReturnType<typeof makeSession>;
  let mockReadSession: ReturnType<typeof makeSession>;

  beforeEach(() => {
    engine = new GraphEngine();
    mockWriteSession = makeSession();
    mockReadSession = makeSession();
    vi.spyOn(neo4j, 'getWriteSession').mockReturnValue(mockWriteSession as unknown as ReturnType<typeof neo4j.getWriteSession>);
    vi.spyOn(neo4j, 'getReadSession').mockReturnValue(mockReadSession as unknown as ReturnType<typeof neo4j.getReadSession>);
  });

  // ─── createResource ─────────────────────────────────────────────────────────

  describe('createResource', () => {
    it('runs a MERGE query with serialized tags and metadata', async () => {
      const resource = makeResource();
      await engine.createResource(resource);

      expect(mockWriteSession.run).toHaveBeenCalledOnce();
      const [query, params] = mockWriteSession.run.mock.calls[0];
      expect(query).toContain('MERGE (r:Resource {id: $id})');
      expect(params.id).toBe('res-1');
      expect(params.tags).toBe(JSON.stringify({ env: 'prod' }));
      expect(params.metadata).toBe(JSON.stringify({ instanceType: 't3.micro' }));
      expect(params.createdAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('closes the session even on success', async () => {
      await engine.createResource(makeResource());
      expect(mockWriteSession.close).toHaveBeenCalledOnce();
    });

    it('closes the session on failure', async () => {
      mockWriteSession.run.mockRejectedValueOnce(new Error('boom'));
      await expect(engine.createResource(makeResource())).rejects.toThrow('boom');
      expect(mockWriteSession.close).toHaveBeenCalledOnce();
    });

    it('serializes null for optional fields', async () => {
      const resource = makeResource({ region: undefined, zone: undefined, cost: undefined });
      await engine.createResource(resource);
      const [, params] = mockWriteSession.run.mock.calls[0];
      expect(params.region).toBeNull();
      expect(params.zone).toBeNull();
      expect(params.cost).toBeNull();
    });
  });

  // ─── updateResource ─────────────────────────────────────────────────────────

  describe('updateResource', () => {
    it('builds SET clause only for provided fields', async () => {
      await engine.updateResource('res-1', { state: ResourceState.STOPPED });

      const [query, params] = mockWriteSession.run.mock.calls[0];
      expect(query).toContain('r.state = $state');
      expect(query).not.toContain('r.name');
      expect(params.state).toBe(ResourceState.STOPPED);
      expect(params.id).toBe('res-1');
    });

    it('always updates updatedAt', async () => {
      await engine.updateResource('res-1', { name: 'new-name' });
      const [, params] = mockWriteSession.run.mock.calls[0];
      expect(params.updatedAt).toBeDefined();
    });

    it('serializes tags when provided', async () => {
      await engine.updateResource('res-1', { tags: { env: 'staging' } });
      const [, params] = mockWriteSession.run.mock.calls[0];
      expect(params.tags).toBe(JSON.stringify({ env: 'staging' }));
    });

    it('serializes metadata when provided', async () => {
      await engine.updateResource('res-1', { metadata: { size: 'large' } });
      const [, params] = mockWriteSession.run.mock.calls[0];
      expect(params.metadata).toBe(JSON.stringify({ size: 'large' }));
    });

    it('can update multiple fields at once', async () => {
      await engine.updateResource('res-1', { name: 'new', state: ResourceState.STOPPED });
      const [query] = mockWriteSession.run.mock.calls[0];
      expect(query).toContain('r.name = $name');
      expect(query).toContain('r.state = $state');
    });
  });

  // ─── deleteResource ─────────────────────────────────────────────────────────

  describe('deleteResource', () => {
    it('runs DETACH DELETE with the given id', async () => {
      await engine.deleteResource('res-1');
      const [query, params] = mockWriteSession.run.mock.calls[0];
      expect(query).toContain('DETACH DELETE r');
      expect(params.id).toBe('res-1');
    });

    it('closes the session after delete', async () => {
      await engine.deleteResource('res-1');
      expect(mockWriteSession.close).toHaveBeenCalledOnce();
    });
  });

  // ─── getResource ────────────────────────────────────────────────────────────

  describe('getResource', () => {
    it('returns null when no record found', async () => {
      const result = await engine.getResource('missing');
      expect(result).toBeNull();
    });

    it('maps Neo4j record to Resource_Model with Date deserialization', async () => {
      const fakeRecord = {
        get: (key: string) => {
          if (key === 'r') {
            return {
              id: 'res-1',
              name: 'test',
              type: ResourceType.COMPUTE,
              provider: Provider.AWS,
              region: 'us-east-1',
              state: ResourceState.RUNNING,
              tags: JSON.stringify({ env: 'prod' }),
              metadata: JSON.stringify({}),
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              discoveredAt: '2024-01-01T00:00:00.000Z',
            };
          }
        },
      };
      mockReadSession.run.mockResolvedValueOnce({ records: [fakeRecord] });

      const result = await engine.getResource('res-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('res-1');
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.tags).toEqual({ env: 'prod' });
    });

    it('parses metadata JSON from Neo4j record', async () => {
      const fakeRecord = {
        get: (key: string) =>
          key === 'r'
            ? {
                id: 'res-2', name: 'x', type: ResourceType.STORAGE, provider: Provider.AWS,
                state: ResourceState.ACTIVE, tags: '{}',
                metadata: JSON.stringify({ bucket: 'my-bucket' }),
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                discoveredAt: '2024-01-01T00:00:00.000Z',
              }
            : undefined,
      };
      mockReadSession.run.mockResolvedValueOnce({ records: [fakeRecord] });
      const result = await engine.getResource('res-2');
      expect(result!.metadata).toEqual({ bucket: 'my-bucket' });
    });
  });

  // ─── listResources ──────────────────────────────────────────────────────────

  describe('listResources', () => {
    it('runs query without WHERE when no filters', async () => {
      await engine.listResources();
      const [query] = mockReadSession.run.mock.calls[0];
      expect(query).not.toContain('WHERE');
    });

    it('adds WHERE clause for type filter', async () => {
      await engine.listResources({ type: ResourceType.COMPUTE });
      const [query, params] = mockReadSession.run.mock.calls[0];
      expect(query).toContain('WHERE r.type = $type');
      expect(params.type).toBe(ResourceType.COMPUTE);
    });

    it('adds WHERE clause for provider filter', async () => {
      await engine.listResources({ provider: Provider.GCP });
      const [query, params] = mockReadSession.run.mock.calls[0];
      expect(query).toContain('r.provider = $provider');
      expect(params.provider).toBe(Provider.GCP);
    });

    it('adds WHERE clause for state filter', async () => {
      await engine.listResources({ state: ResourceState.STOPPED });
      const [query, params] = mockReadSession.run.mock.calls[0];
      expect(query).toContain('r.state = $state');
      expect(params.state).toBe(ResourceState.STOPPED);
    });

    it('filters by tags in-memory', async () => {
      const now = '2024-01-01T00:00:00.000Z';
      const makeRec = (tags: Record<string, string>) => ({
        get: (key: string) =>
          key === 'r'
            ? {
                id: 'x', name: 'x', type: ResourceType.COMPUTE, provider: Provider.AWS,
                state: ResourceState.RUNNING, tags: JSON.stringify(tags), metadata: '{}',
                createdAt: now, updatedAt: now, discoveredAt: now,
              }
            : undefined,
      });

      mockReadSession.run.mockResolvedValueOnce({
        records: [makeRec({ env: 'prod' }), makeRec({ env: 'dev' })],
      });

      const results = await engine.listResources({ tags: { env: 'prod' } });
      expect(results).toHaveLength(1);
      expect(results[0].tags.env).toBe('prod');
    });

    it('returns empty array when no resources match', async () => {
      mockReadSession.run.mockResolvedValueOnce({ records: [] });
      const results = await engine.listResources({ type: ResourceType.FUNCTION });
      expect(results).toEqual([]);
    });
  });

  // ─── createRelationship ─────────────────────────────────────────────────────

  describe('createRelationship', () => {
    it('runs MERGE with correct relationship type', async () => {
      await engine.createRelationship('a', 'b', RelationshipType.DEPENDS_ON, { weight: 1 });
      const [query, params] = mockWriteSession.run.mock.calls[0];
      expect(query).toContain('MERGE (a)-[rel:DEPENDS_ON');
      expect(params.from).toBe('a');
      expect(params.to).toBe('b');
      expect(params.properties).toBe(JSON.stringify({ weight: 1 }));
    });

    it('defaults to empty props when none provided', async () => {
      await engine.createRelationship('a', 'b', RelationshipType.USES);
      const [, params] = mockWriteSession.run.mock.calls[0];
      expect(params.properties).toBe('{}');
    });

    it('generates a composite id from from:type:to', async () => {
      await engine.createRelationship('src', 'dst', RelationshipType.CONNECTS_TO);
      const [, params] = mockWriteSession.run.mock.calls[0];
      expect(params.relId).toBe('src:CONNECTS_TO:dst');
    });

    it('supports all relationship types', async () => {
      for (const relType of Object.values(RelationshipType)) {
        mockWriteSession.run.mockResolvedValueOnce({ records: [] });
        await engine.createRelationship('a', 'b', relType);
        const [query] = mockWriteSession.run.mock.calls.at(-1)!;
        expect(query).toContain(relType);
      }
    });
  });

  // ─── deleteRelationship ─────────────────────────────────────────────────────

  describe('deleteRelationship', () => {
    it('runs DELETE on the matching relationship', async () => {
      await engine.deleteRelationship('a', 'b', RelationshipType.CONNECTS_TO);
      const [query, params] = mockWriteSession.run.mock.calls[0];
      expect(query).toContain('DELETE rel');
      expect(query).toContain(':CONNECTS_TO');
      expect(params.from).toBe('a');
      expect(params.to).toBe('b');
    });

    it('closes the session after delete', async () => {
      await engine.deleteRelationship('a', 'b', RelationshipType.USES);
      expect(mockWriteSession.close).toHaveBeenCalledOnce();
    });
  });

  // ─── getRelationships ───────────────────────────────────────────────────────

  describe('getRelationships', () => {
    it('returns empty array when no relationships', async () => {
      const result = await engine.getRelationships('res-1');
      expect(result).toEqual([]);
    });

    it('maps records to Relationship objects', async () => {
      const fakeRecord = {
        get: (key: string) => {
          const data: Record<string, unknown> = {
            id: 'a:DEPENDS_ON:b',
            type: 'DEPENDS_ON',
            fromId: 'a',
            toId: 'b',
            properties: JSON.stringify({ weight: 2 }),
          };
          return data[key];
        },
      };
      mockReadSession.run.mockResolvedValueOnce({ records: [fakeRecord] });

      const result = await engine.getRelationships('a');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(RelationshipType.DEPENDS_ON);
      expect(result[0].properties).toEqual({ weight: 2 });
      expect(result[0].fromId).toBe('a');
      expect(result[0].toId).toBe('b');
    });

    it('handles null properties gracefully', async () => {
      const fakeRecord = {
        get: (key: string) => {
          const data: Record<string, unknown> = {
            id: 'a:USES:b', type: 'USES', fromId: 'a', toId: 'b', properties: null,
          };
          return data[key];
        },
      };
      mockReadSession.run.mockResolvedValueOnce({ records: [fakeRecord] });
      const result = await engine.getRelationships('a');
      expect(result[0].properties).toEqual({});
    });
  });

  // ─── Circuit Breaker ─────────────────────────────────────────────────────────

  describe('circuit breaker', () => {
    it('opens after 5 consecutive failures', async () => {
      mockWriteSession.run.mockRejectedValue(new Error('db down'));
      vi.spyOn(neo4j, 'getWriteSession').mockReturnValue(mockWriteSession as unknown as ReturnType<typeof neo4j.getWriteSession>);

      for (let i = 0; i < 5; i++) {
        await expect(engine.deleteResource('x')).rejects.toThrow();
      }

      await expect(engine.deleteResource('x')).rejects.toThrow('circuit breaker is OPEN');
    });

    it('allows calls through when circuit is closed', async () => {
      mockWriteSession.run.mockResolvedValue({ records: [] });
      await expect(engine.deleteResource('x')).resolves.toBeUndefined();
    });

    it('resets failure count on success', async () => {
      mockWriteSession.run
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({ records: [] });

      await expect(engine.deleteResource('x')).rejects.toThrow();
      await expect(engine.deleteResource('x')).rejects.toThrow();
      await expect(engine.deleteResource('x')).resolves.toBeUndefined();
      // After success, circuit should still be closed — next call should work
      mockWriteSession.run.mockResolvedValueOnce({ records: [] });
      await expect(engine.deleteResource('x')).resolves.toBeUndefined();
    });

    it('transitions to HALF_OPEN after recovery timeout and allows a call through', async () => {
      vi.useFakeTimers();
      mockWriteSession.run.mockRejectedValue(new Error('db down'));

      for (let i = 0; i < 5; i++) {
        await expect(engine.deleteResource('x')).rejects.toThrow();
      }

      // Advance past the 30s recovery timeout
      vi.advanceTimersByTime(31_000);

      // Next call should be allowed through (HALF_OPEN), not blocked by circuit breaker
      mockWriteSession.run.mockResolvedValueOnce({ records: [] });
      await expect(engine.deleteResource('x')).resolves.toBeUndefined();

      vi.useRealTimers();
    });
  });

  // ─── Retry Logic ─────────────────────────────────────────────────────────────

  describe('retry logic', () => {
    it('retries on transient ServiceUnavailable error', async () => {
      const transientErr = Object.assign(new Error('ServiceUnavailable'), { code: 'ServiceUnavailable' });
      mockWriteSession.run
        .mockRejectedValueOnce(transientErr)
        .mockRejectedValueOnce(transientErr)
        .mockResolvedValueOnce({ records: [] });

      await expect(engine.createResource(makeResource())).resolves.toBeUndefined();
      expect(mockWriteSession.run).toHaveBeenCalledTimes(3);
    });

    it('retries on transient SessionExpired error', async () => {
      const transientErr = Object.assign(new Error('SessionExpired'), { code: 'SessionExpired' });
      mockWriteSession.run
        .mockRejectedValueOnce(transientErr)
        .mockResolvedValueOnce({ records: [] });

      await expect(engine.createResource(makeResource())).resolves.toBeUndefined();
      expect(mockWriteSession.run).toHaveBeenCalledTimes(2);
    });

    it('does not retry on non-transient errors', async () => {
      mockWriteSession.run.mockRejectedValue(new Error('ConstraintViolation'));
      await expect(engine.createResource(makeResource())).rejects.toThrow('ConstraintViolation');
      expect(mockWriteSession.run).toHaveBeenCalledTimes(1);
    });

    it('throws after exhausting all retries on persistent transient error', async () => {
      const transientErr = Object.assign(new Error('ServiceUnavailable'), { code: 'ServiceUnavailable' });
      mockWriteSession.run.mockRejectedValue(transientErr);

      await expect(engine.createResource(makeResource())).rejects.toThrow('ServiceUnavailable');
      // 1 initial + 3 retries = 4 total attempts
      expect(mockWriteSession.run).toHaveBeenCalledTimes(4);
    });
  });
});

// ─── GraphQueryEngine Tests ───────────────────────────────────────────────────

describe('GraphQueryEngine', () => {
  let queryEngine: GraphQueryEngine;
  let mockReadSession: ReturnType<typeof makeSession>;

  beforeEach(() => {
    queryEngine = new GraphQueryEngine();
    mockReadSession = makeSession();
    vi.spyOn(neo4j, 'getReadSession').mockReturnValue(mockReadSession as unknown as ReturnType<typeof neo4j.getReadSession>);
  });

  // ─── getDependencies ────────────────────────────────────────────────────────

  describe('getDependencies', () => {
    it('queries with default depth of 1', async () => {
      await queryEngine.getDependencies('res-1');
      const [query, params] = mockReadSession.run.mock.calls[0];
      expect(query).toContain('DEPENDS_ON|USES|CONNECTS_TO*1..$depth');
      expect(params.id).toBe('res-1');
      expect(params.depth).toBe(1);
    });

    it('queries with specified depth', async () => {
      await queryEngine.getDependencies('res-1', 2);
      const [, params] = mockReadSession.run.mock.calls[0];
      expect(params.depth).toBe(2);
    });

    it('caps depth at 3', async () => {
      await queryEngine.getDependencies('res-1', 10);
      const [, params] = mockReadSession.run.mock.calls[0];
      expect(params.depth).toBe(3);
    });

    it('enforces minimum depth of 1', async () => {
      await queryEngine.getDependencies('res-1', 0);
      const [, params] = mockReadSession.run.mock.calls[0];
      expect(params.depth).toBe(1);
    });

    it('maps returned records to Resource_Model', async () => {
      const fakeRecord = {
        get: (key: string) =>
          key === 'dep'
            ? {
                id: 'dep-1', name: 'dep', type: ResourceType.DATABASE, provider: Provider.AWS,
                state: ResourceState.RUNNING, tags: '{}', metadata: '{}',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                discoveredAt: '2024-01-01T00:00:00.000Z',
              }
            : undefined,
      };
      mockReadSession.run.mockResolvedValueOnce({ records: [fakeRecord] });

      const result = await queryEngine.getDependencies('res-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('dep-1');
      expect(result[0].type).toBe(ResourceType.DATABASE);
    });

    it('returns empty array when no dependencies', async () => {
      const result = await queryEngine.getDependencies('isolated');
      expect(result).toEqual([]);
    });
  });

  // ─── getDependents ──────────────────────────────────────────────────────────

  describe('getDependents', () => {
    it('queries with default depth of 1', async () => {
      await queryEngine.getDependents('res-1');
      const [query, params] = mockReadSession.run.mock.calls[0];
      expect(query).toContain('DEPENDS_ON|USES|CONNECTS_TO*1..$depth');
      expect(params.id).toBe('res-1');
      expect(params.depth).toBe(1);
    });

    it('uses reverse direction (dependents point TO the resource)', async () => {
      await queryEngine.getDependents('res-1');
      const [query] = mockReadSession.run.mock.calls[0];
      // dependents query: (dep)-[...]->(r {id})
      expect(query).toContain('->(r:Resource {id: $id})');
    });

    it('caps depth at 3', async () => {
      await queryEngine.getDependents('res-1', 99);
      const [, params] = mockReadSession.run.mock.calls[0];
      expect(params.depth).toBe(3);
    });

    it('maps returned records to Resource_Model', async () => {
      const fakeRecord = {
        get: (key: string) =>
          key === 'dep'
            ? {
                id: 'caller-1', name: 'caller', type: ResourceType.SERVICE, provider: Provider.AWS,
                state: ResourceState.RUNNING, tags: '{}', metadata: '{}',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                discoveredAt: '2024-01-01T00:00:00.000Z',
              }
            : undefined,
      };
      mockReadSession.run.mockResolvedValueOnce({ records: [fakeRecord] });

      const result = await queryEngine.getDependents('res-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('caller-1');
    });

    it('returns empty array when no dependents', async () => {
      const result = await queryEngine.getDependents('leaf-node');
      expect(result).toEqual([]);
    });
  });

  // ─── findUnusedResources ────────────────────────────────────────────────────

  describe('findUnusedResources', () => {
    it('queries for resources with no incoming relationships', async () => {
      await queryEngine.findUnusedResources();
      const [query] = mockReadSession.run.mock.calls[0];
      expect(query).toContain('NOT ()-[:DEPENDS_ON|USES|CONNECTS_TO]->(r)');
    });

    it('returns mapped Resource_Model list', async () => {
      const fakeRecord = {
        get: (key: string) =>
          key === 'r'
            ? {
                id: 'orphan-1', name: 'orphan', type: ResourceType.VOLUME, provider: Provider.DOCKER,
                state: ResourceState.INACTIVE, tags: '{}', metadata: '{}',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                discoveredAt: '2024-01-01T00:00:00.000Z',
              }
            : undefined,
      };
      mockReadSession.run.mockResolvedValueOnce({ records: [fakeRecord] });

      const result = await queryEngine.findUnusedResources();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('orphan-1');
    });

    it('returns empty array when all resources are used', async () => {
      const result = await queryEngine.findUnusedResources();
      expect(result).toEqual([]);
    });
  });

  // ─── findCircularDependencies ────────────────────────────────────────────────

  describe('findCircularDependencies', () => {
    it('returns empty array when no cycles exist', async () => {
      const result = await queryEngine.findCircularDependencies();
      expect(result).toEqual([]);
    });

    it('returns cycles from APOC SCC when available', async () => {
      const fakeRecord = {
        get: (key: string) => key === 'nodeIds' ? ['a', 'b', 'c'] : undefined,
      };
      mockReadSession.run.mockResolvedValueOnce({ records: [fakeRecord] });

      const result = await queryEngine.findCircularDependencies();
      expect(result).toHaveLength(1);
      expect(result[0].nodes).toEqual(['a', 'b', 'c']);
      expect(result[0].edges).toEqual([]);
    });

    it('falls back to manual Cypher detection when APOC unavailable', async () => {
      // First call (APOC) throws, second call (manual) returns a cycle
      mockReadSession.run
        .mockRejectedValueOnce(new Error('APOC not available'))
        .mockResolvedValueOnce({
          records: [
            {
              get: (key: string) => {
                if (key === 'nodeIds') return ['x', 'y', 'x'];
                if (key === 'edgeTypes') return ['DEPENDS_ON', 'DEPENDS_ON'];
                return undefined;
              },
            },
          ],
        });

      const result = await queryEngine.findCircularDependencies();
      expect(result).toHaveLength(1);
      expect(result[0].nodes).toEqual(['x', 'y', 'x']);
      expect(result[0].edges).toEqual(['DEPENDS_ON', 'DEPENDS_ON']);
    });

    it('deduplicates cycles in manual fallback', async () => {
      // Two records with same nodes (different order) should be deduplicated
      mockReadSession.run
        .mockRejectedValueOnce(new Error('APOC not available'))
        .mockResolvedValueOnce({
          records: [
            {
              get: (key: string) => {
                if (key === 'nodeIds') return ['a', 'b'];
                if (key === 'edgeTypes') return ['DEPENDS_ON'];
                return undefined;
              },
            },
            {
              get: (key: string) => {
                if (key === 'nodeIds') return ['b', 'a'];
                if (key === 'edgeTypes') return ['DEPENDS_ON'];
                return undefined;
              },
            },
          ],
        });

      const result = await queryEngine.findCircularDependencies();
      expect(result).toHaveLength(1);
    });
  });

  // ─── listResourcesPaged ─────────────────────────────────────────────────────

  describe('listResourcesPaged', () => {
    function makeCountRecord(total: number) {
      return { get: (key: string) => key === 'total' ? total : undefined };
    }

    function makeDataRecord(id: string, tags: Record<string, string> = {}) {
      const now = '2024-01-01T00:00:00.000Z';
      return {
        get: (key: string) =>
          key === 'r'
            ? {
                id, name: id, type: ResourceType.COMPUTE, provider: Provider.AWS,
                state: ResourceState.RUNNING, tags: JSON.stringify(tags), metadata: '{}',
                createdAt: now, updatedAt: now, discoveredAt: now,
              }
            : undefined,
      };
    }

    it('returns paged results with total and hasMore', async () => {
      mockReadSession.run
        .mockResolvedValueOnce({ records: [makeCountRecord(10)] })
        .mockResolvedValueOnce({ records: [makeDataRecord('r1'), makeDataRecord('r2')] });

      const result = await queryEngine.listResourcesPaged(undefined, { limit: 2, offset: 0 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.hasMore).toBe(true);
    });

    it('runs count and data queries serially on the same session', async () => {
      let activeRuns = 0;

      mockReadSession.run.mockImplementation(async (query: string) => {
        if (activeRuns > 0) {
          throw new Error('session.run called concurrently');
        }

        activeRuns += 1;
        try {
          await Promise.resolve();
          if (query.includes('count(r)')) {
            return { records: [makeCountRecord(1)] };
          }
          return { records: [makeDataRecord('r1')] };
        } finally {
          activeRuns -= 1;
        }
      });

      const result = await queryEngine.listResourcesPaged(undefined, { limit: 1, offset: 0 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockReadSession.run).toHaveBeenCalledTimes(2);
    });

    it('hasMore is false when all items returned', async () => {
      mockReadSession.run
        .mockResolvedValueOnce({ records: [makeCountRecord(2)] })
        .mockResolvedValueOnce({ records: [makeDataRecord('r1'), makeDataRecord('r2')] });

      const result = await queryEngine.listResourcesPaged(undefined, { limit: 50, offset: 0 });
      expect(result.hasMore).toBe(false);
    });

    it('applies type filter in query', async () => {
      mockReadSession.run
        .mockResolvedValueOnce({ records: [makeCountRecord(0)] })
        .mockResolvedValueOnce({ records: [] });

      await queryEngine.listResourcesPaged({ type: ResourceType.STORAGE });
      const [countQuery] = mockReadSession.run.mock.calls[0];
      expect(countQuery).toContain('r.type = $type');
    });

    it('filters by tags in-memory after query', async () => {
      mockReadSession.run
        .mockResolvedValueOnce({ records: [makeCountRecord(2)] })
        .mockResolvedValueOnce({
          records: [
            makeDataRecord('r1', { env: 'prod' }),
            makeDataRecord('r2', { env: 'dev' }),
          ],
        });

      const result = await queryEngine.listResourcesPaged({ tags: { env: 'prod' } });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('r1');
    });

    it('uses default limit of 50 and offset of 0', async () => {
      mockReadSession.run
        .mockResolvedValueOnce({ records: [makeCountRecord(0)] })
        .mockResolvedValueOnce({ records: [] });

      await queryEngine.listResourcesPaged();
      const [, params] = mockReadSession.run.mock.calls[1];
      expect(params.limit).toBe(50);
      expect(params.offset).toBe(0);
    });

    it('returns empty items and total 0 when no resources', async () => {
      mockReadSession.run
        .mockResolvedValueOnce({ records: [makeCountRecord(0)] })
        .mockResolvedValueOnce({ records: [] });

      const result = await queryEngine.listResourcesPaged();
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });
});
