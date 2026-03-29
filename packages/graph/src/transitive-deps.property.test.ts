/**
 * Property 8: Transitive Dependency Resolution
 * Validates: Requirements 6.8
 *
 * For any chain A→B→C→D (3 levels deep):
 *   - getDependencies(A, 1) returns only B
 *   - getDependencies(A, 2) returns B and C
 *   - getDependencies(A, 3) returns B, C, and D
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { GraphQueryEngine } from './queries';
import * as neo4j from './neo4j';
import { ResourceType, Provider, ResourceState } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResourceProps(id: string) {
  const now = '2024-01-01T00:00:00.000Z';
  return {
    id,
    name: `resource-${id}`,
    type: ResourceType.COMPUTE,
    provider: Provider.AWS,
    region: 'us-east-1',
    state: ResourceState.RUNNING,
    tags: '{}',
    metadata: '{}',
    createdAt: now,
    updatedAt: now,
    discoveredAt: now,
  };
}

function makeRecord(id: string) {
  const props = makeResourceProps(id);
  return {
    get: (key: string) => (key === 'dep' ? props : undefined),
  };
}

/**
 * Build a mock session that, given a depth parameter, returns the correct
 * subset of nodes from the chain A→B→C→D.
 *
 * The chain is: nodeIds[0] → nodeIds[1] → nodeIds[2] → nodeIds[3]
 * At depth d, getDependencies(nodeIds[0], d) should return nodeIds[1..d].
 */
function makeChainSession(nodeIds: [string, string, string, string]) {
  const [, b, c, d] = nodeIds;

  return {
    run: vi.fn().mockImplementation((_query: string, params: { depth: number }) => {
      const depth = Number(params.depth);
      const results: ReturnType<typeof makeRecord>[] = [];
      if (depth >= 1) results.push(makeRecord(b));
      if (depth >= 2) results.push(makeRecord(c));
      if (depth >= 3) results.push(makeRecord(d));
      return Promise.resolve({ records: results });
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates 4 distinct resource IDs representing a linear chain A→B→C→D.
 */
const chainArb = fc
  .uniqueArray(fc.hexaString({ minLength: 4, maxLength: 8 }), { minLength: 4, maxLength: 4 })
  .map((ids) => ids as [string, string, string, string]);

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 8: Transitive Dependency Resolution', () => {
  let queryEngine: GraphQueryEngine;
  let mockSession: ReturnType<typeof makeChainSession>;

  beforeEach(() => {
    queryEngine = new GraphQueryEngine();
  });

  it('depth=1 returns only the direct dependency (B), not C or D', async () => {
    /**
     * Validates: Requirements 6.8
     * For any chain A→B→C→D, getDependencies(A, 1) must return exactly B.
     */
    await fc.assert(
      fc.asyncProperty(chainArb, async ([a, b, c, d]) => {
        mockSession = makeChainSession([a, b, c, d]);
        vi.spyOn(neo4j, 'getReadSession').mockReturnValue(
          mockSession as unknown as ReturnType<typeof neo4j.getReadSession>
        );

        const result = await queryEngine.getDependencies(a, 1);
        const ids = result.map((r) => r.id);

        expect(ids).toContain(b);
        expect(ids).not.toContain(c);
        expect(ids).not.toContain(d);
      }),
      { numRuns: 50 }
    );
  });

  it('depth=2 returns B and C, but not D', async () => {
    /**
     * Validates: Requirements 6.8
     * For any chain A→B→C→D, getDependencies(A, 2) must return B and C but not D.
     */
    await fc.assert(
      fc.asyncProperty(chainArb, async ([a, b, c, d]) => {
        mockSession = makeChainSession([a, b, c, d]);
        vi.spyOn(neo4j, 'getReadSession').mockReturnValue(
          mockSession as unknown as ReturnType<typeof neo4j.getReadSession>
        );

        const result = await queryEngine.getDependencies(a, 2);
        const ids = result.map((r) => r.id);

        expect(ids).toContain(b);
        expect(ids).toContain(c);
        expect(ids).not.toContain(d);
      }),
      { numRuns: 50 }
    );
  });

  it('depth=3 returns B, C, and D (full 3-level chain)', async () => {
    /**
     * Validates: Requirements 6.8
     * For any chain A→B→C→D, getDependencies(A, 3) must return B, C, and D.
     */
    await fc.assert(
      fc.asyncProperty(chainArb, async ([a, b, c, d]) => {
        mockSession = makeChainSession([a, b, c, d]);
        vi.spyOn(neo4j, 'getReadSession').mockReturnValue(
          mockSession as unknown as ReturnType<typeof neo4j.getReadSession>
        );

        const result = await queryEngine.getDependencies(a, 3);
        const ids = result.map((r) => r.id);

        expect(ids).toContain(b);
        expect(ids).toContain(c);
        expect(ids).toContain(d);
      }),
      { numRuns: 50 }
    );
  });

  it('depth > MAX_DEPTH (3) is capped and still returns B, C, and D', async () => {
    /**
     * Validates: Requirements 6.8
     * Depth is capped at MAX_DEPTH=3, so any depth > 3 behaves like depth=3.
     */
    await fc.assert(
      fc.asyncProperty(
        chainArb,
        fc.integer({ min: 4, max: 100 }),
        async ([a, b, c, d], excessiveDepth) => {
          mockSession = makeChainSession([a, b, c, d]);
          vi.spyOn(neo4j, 'getReadSession').mockReturnValue(
            mockSession as unknown as ReturnType<typeof neo4j.getReadSession>
          );

          const result = await queryEngine.getDependencies(a, excessiveDepth);
          const ids = result.map((r) => r.id);

          // Capped at 3 — same as depth=3
          expect(ids).toContain(b);
          expect(ids).toContain(c);
          expect(ids).toContain(d);

          // Verify the session was called with capped depth of 3
          const [, params] = mockSession.run.mock.calls[0];
          expect(params.depth.toNumber()).toBe(3);
        }
      ),
      { numRuns: 50 }
    );
  });
});
