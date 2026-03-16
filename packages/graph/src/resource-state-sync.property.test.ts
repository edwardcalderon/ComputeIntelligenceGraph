/**
 * Property 10: Resource State Synchronization
 * Validates: Requirements 6.10
 *
 * For any resource update, the state field is correctly persisted and retrievable.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { GraphEngine } from './engine';
import * as neo4j from './neo4j';
import { ResourceState, ResourceType, Provider } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWriteSession(capturedParams: Record<string, unknown>[]) {
  return {
    run: vi.fn().mockImplementation((_query: string, params: Record<string, unknown>) => {
      capturedParams.push(params);
      return Promise.resolve({ records: [] });
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function makeReadSession(id: string, state: ResourceState) {
  const now = new Date().toISOString();
  return {
    run: vi.fn().mockResolvedValue({
      records: [
        {
          get: (_key: string) => ({
            id,
            name: `resource-${id}`,
            type: ResourceType.COMPUTE,
            provider: Provider.AWS,
            region: 'us-east-1',
            state,
            tags: '{}',
            metadata: '{}',
            createdAt: now,
            updatedAt: now,
            discoveredAt: now,
          }),
        },
      ],
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const resourceIdArb = fc.hexaString({ minLength: 4, maxLength: 12 });

const resourceStateArb = fc.constantFrom(
  ResourceState.RUNNING,
  ResourceState.STOPPED,
  ResourceState.TERMINATED,
  ResourceState.ACTIVE,
  ResourceState.INACTIVE,
  ResourceState.PENDING,
  ResourceState.FAILED,
);

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 10: Resource State Synchronization', () => {
  let engine: GraphEngine;

  beforeEach(() => {
    engine = new GraphEngine();
    vi.restoreAllMocks();
  });

  it('updateResource persists the exact state value in the Cypher SET clause', async () => {
    /**
     * Validates: Requirements 6.10
     * For any resource state, updateResource() must include the state in the
     * Cypher parameters so it is correctly written to Neo4j.
     */
    await fc.assert(
      fc.asyncProperty(resourceIdArb, resourceStateArb, async (id, state) => {
        const captured: Record<string, unknown>[] = [];
        const writeSession = makeWriteSession(captured);
        vi.spyOn(neo4j, 'getWriteSession').mockReturnValue(
          writeSession as unknown as ReturnType<typeof neo4j.getWriteSession>
        );

        await engine.updateResource(id, { state });

        expect(writeSession.run).toHaveBeenCalledTimes(1);
        const params = captured[0];
        expect(params['state']).toBe(state);
        expect(params['id']).toBe(id);
      }),
      { numRuns: 50 }
    );
  });

  it('getResource returns the exact state that was stored', async () => {
    /**
     * Validates: Requirements 6.10
     * For any resource state, getResource() must return the same state value
     * that was persisted.
     */
    await fc.assert(
      fc.asyncProperty(resourceIdArb, resourceStateArb, async (id, state) => {
        const readSession = makeReadSession(id, state);
        vi.spyOn(neo4j, 'getReadSession').mockReturnValue(
          readSession as unknown as ReturnType<typeof neo4j.getReadSession>
        );

        const resource = await engine.getResource(id);

        expect(resource).not.toBeNull();
        expect(resource!.state).toBe(state);
        expect(resource!.id).toBe(id);
      }),
      { numRuns: 50 }
    );
  });

  it('state field appears in the SET clause of the update query', async () => {
    /**
     * Validates: Requirements 6.10
     * The Cypher query for updateResource must include `r.state = $state`
     * when a state update is requested.
     */
    await fc.assert(
      fc.asyncProperty(resourceIdArb, resourceStateArb, async (id, state) => {
        const captured: Record<string, unknown>[] = [];
        const writeSession = makeWriteSession(captured);
        vi.spyOn(neo4j, 'getWriteSession').mockReturnValue(
          writeSession as unknown as ReturnType<typeof neo4j.getWriteSession>
        );

        await engine.updateResource(id, { state });

        const [query] = writeSession.run.mock.calls[0] as [string, ...unknown[]];
        expect(query).toContain('r.state = $state');
      }),
      { numRuns: 50 }
    );
  });
});
