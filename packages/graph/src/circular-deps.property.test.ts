/**
 * Property 9: Circular Dependency Detection
 * Validates: Requirements 6.9
 *
 * Properties tested:
 *   1. For any graph with a known cycle (A→B→C→A), findCircularDependencies()
 *      must return at least one cycle containing those nodes.
 *   2. For any acyclic graph (DAG), findCircularDependencies() must return [].
 *   3. Deduplication: cycles with the same sorted node set appear only once.
 *   4. Self-loops (A→A) are cycles and must be detected.
 *
 * Both the APOC path and the manual Cypher fallback path are exercised.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { GraphQueryEngine } from './queries';
import * as neo4j from './neo4j';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal mock session that returns the given records for any run() call. */
function makeSession(records: object[]) {
  return {
    run: vi.fn().mockResolvedValue({ records }),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

/** Build a mock session that throws on the first call (simulating APOC unavailable)
 *  and returns the given records on the second call (manual fallback). */
function makeApocFailSession(fallbackRecords: object[]) {
  const run = vi
    .fn()
    .mockRejectedValueOnce(new Error('APOC not available'))
    .mockResolvedValueOnce({ records: fallbackRecords });
  return {
    run,
    close: vi.fn().mockResolvedValue(undefined),
  };
}

/** Create a fake record whose get('nodeIds') returns the given array. */
function cycleRecord(nodeIds: string[]) {
  return { get: (key: string) => (key === 'nodeIds' ? nodeIds : []) };
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates an array of 2–5 distinct node IDs representing a simple cycle.
 * e.g. ["a","b","c"] represents A→B→C→A.
 */
const cycleNodesArb = fc
  .uniqueArray(fc.string({ minLength: 1, maxLength: 8 }), { minLength: 2, maxLength: 5 })
  .filter((ids) => ids.every((id) => id.length > 0));

/**
 * Generates an array of 2–6 distinct node IDs representing a DAG (no cycles).
 * We model a DAG as a linear chain A→B→C… which has no back-edges.
 */
const dagNodesArb = fc
  .uniqueArray(fc.string({ minLength: 1, maxLength: 8 }), { minLength: 2, maxLength: 6 })
  .filter((ids) => ids.every((id) => id.length > 0));

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 9: Circular Dependency Detection', () => {
  let engine: GraphQueryEngine;

  beforeEach(() => {
    engine = new GraphQueryEngine();
    vi.restoreAllMocks();
  });

  // ── Property 9.1: Known cycle detected (APOC path) ────────────────────────

  it('APOC path: detects a known cycle — result contains all cycle nodes', async () => {
    /**
     * Validates: Requirements 6.9
     * For any cycle A→B→…→A, findCircularDependencies() must return at least
     * one Cycle whose nodes include every node in the cycle.
     */
    await fc.assert(
      fc.asyncProperty(cycleNodesArb, async (cycleNodes) => {
        // APOC returns the cycle nodes as a single SCC component
        const session = makeSession([cycleRecord(cycleNodes)]);
        vi.spyOn(neo4j, 'getReadSession').mockReturnValue(
          session as unknown as ReturnType<typeof neo4j.getReadSession>
        );

        const cycles = await engine.findCircularDependencies();

        expect(cycles.length).toBeGreaterThanOrEqual(1);
        // At least one returned cycle must contain all nodes of our known cycle
        const found = cycles.some((c) =>
          cycleNodes.every((n) => c.nodes.includes(n))
        );
        expect(found).toBe(true);
      }),
      { numRuns: 50 }
    );
  });

  // ── Property 9.2: Known cycle detected (manual fallback path) ─────────────

  it('manual fallback path: detects a known cycle when APOC is unavailable', async () => {
    /**
     * Validates: Requirements 6.9
     * When APOC throws, the manual Cypher fallback must still detect cycles.
     */
    await fc.assert(
      fc.asyncProperty(cycleNodesArb, async (cycleNodes) => {
        const session = makeApocFailSession([cycleRecord(cycleNodes)]);
        vi.spyOn(neo4j, 'getReadSession').mockReturnValue(
          session as unknown as ReturnType<typeof neo4j.getReadSession>
        );

        const cycles = await engine.findCircularDependencies();

        expect(cycles.length).toBeGreaterThanOrEqual(1);
        const found = cycles.some((c) =>
          cycleNodes.every((n) => c.nodes.includes(n))
        );
        expect(found).toBe(true);
      }),
      { numRuns: 50 }
    );
  });

  // ── Property 9.3: Acyclic graph returns empty array ───────────────────────

  it('acyclic graph (DAG) returns an empty cycle list', async () => {
    /**
     * Validates: Requirements 6.9
     * For any DAG, findCircularDependencies() must return [].
     */
    await fc.assert(
      fc.asyncProperty(dagNodesArb, async (_dagNodes) => {
        // No SCC components with size > 1 → APOC returns no records
        const session = makeSession([]);
        vi.spyOn(neo4j, 'getReadSession').mockReturnValue(
          session as unknown as ReturnType<typeof neo4j.getReadSession>
        );

        const cycles = await engine.findCircularDependencies();
        expect(cycles).toEqual([]);
      }),
      { numRuns: 50 }
    );
  });

  it('acyclic graph (DAG) returns empty list via manual fallback too', async () => {
    /**
     * Validates: Requirements 6.9
     * When APOC is unavailable and the graph is acyclic, the fallback must
     * also return [].
     */
    await fc.assert(
      fc.asyncProperty(dagNodesArb, async (_dagNodes) => {
        const session = makeApocFailSession([]);
        vi.spyOn(neo4j, 'getReadSession').mockReturnValue(
          session as unknown as ReturnType<typeof neo4j.getReadSession>
        );

        const cycles = await engine.findCircularDependencies();
        expect(cycles).toEqual([]);
      }),
      { numRuns: 50 }
    );
  });

  // ── Property 9.4: Deduplication ───────────────────────────────────────────

  it('duplicate cycles (same sorted nodes) appear only once in results', async () => {
    /**
     * Validates: Requirements 6.9
     * If the database returns the same cycle multiple times (e.g. different
     * starting nodes), the result must deduplicate them.
     * Deduplication key: sorted node IDs joined.
     */
    await fc.assert(
      fc.asyncProperty(cycleNodesArb, async (cycleNodes) => {
        // Return the same cycle twice (simulates duplicate paths from Cypher)
        const session = makeApocFailSession([
          cycleRecord(cycleNodes),
          cycleRecord([...cycleNodes].reverse()), // same nodes, different order
        ]);
        vi.spyOn(neo4j, 'getReadSession').mockReturnValue(
          session as unknown as ReturnType<typeof neo4j.getReadSession>
        );

        const cycles = await engine.findCircularDependencies();

        // Build dedup keys from the result
        const keys = cycles.map((c) => [...c.nodes].sort().join(','));
        const uniqueKeys = new Set(keys);

        expect(keys.length).toBe(uniqueKeys.size);
      }),
      { numRuns: 50 }
    );
  });

  // ── Property 9.5: Self-loops are detected ─────────────────────────────────

  it('self-loop (A→A) is detected as a cycle', async () => {
    /**
     * Validates: Requirements 6.9
     * A self-loop is the simplest cycle. findCircularDependencies() must
     * return at least one cycle containing the self-looping node.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 8 }).filter((s) => s.length > 0),
        async (nodeId) => {
          // APOC path: SCC of size 1 with a self-loop
          const session = makeSession([cycleRecord([nodeId])]);
          vi.spyOn(neo4j, 'getReadSession').mockReturnValue(
            session as unknown as ReturnType<typeof neo4j.getReadSession>
          );

          const cycles = await engine.findCircularDependencies();

          expect(cycles.length).toBeGreaterThanOrEqual(1);
          const found = cycles.some((c) => c.nodes.includes(nodeId));
          expect(found).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('self-loop (A→A) detected via manual fallback', async () => {
    /**
     * Validates: Requirements 6.9
     * Self-loops must also be detected through the manual Cypher fallback.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 8 }).filter((s) => s.length > 0),
        async (nodeId) => {
          const session = makeApocFailSession([cycleRecord([nodeId])]);
          vi.spyOn(neo4j, 'getReadSession').mockReturnValue(
            session as unknown as ReturnType<typeof neo4j.getReadSession>
          );

          const cycles = await engine.findCircularDependencies();

          expect(cycles.length).toBeGreaterThanOrEqual(1);
          const found = cycles.some((c) => c.nodes.includes(nodeId));
          expect(found).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});
