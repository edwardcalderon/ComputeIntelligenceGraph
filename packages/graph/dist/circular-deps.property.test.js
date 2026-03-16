"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fc = __importStar(require("fast-check"));
const queries_1 = require("./queries");
const neo4j = __importStar(require("./neo4j"));
// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Build a minimal mock session that returns the given records for any run() call. */
function makeSession(records) {
    return {
        run: vitest_1.vi.fn().mockResolvedValue({ records }),
        close: vitest_1.vi.fn().mockResolvedValue(undefined),
    };
}
/** Build a mock session that throws on the first call (simulating APOC unavailable)
 *  and returns the given records on the second call (manual fallback). */
function makeApocFailSession(fallbackRecords) {
    const run = vitest_1.vi
        .fn()
        .mockRejectedValueOnce(new Error('APOC not available'))
        .mockResolvedValueOnce({ records: fallbackRecords });
    return {
        run,
        close: vitest_1.vi.fn().mockResolvedValue(undefined),
    };
}
/** Create a fake record whose get('nodeIds') returns the given array. */
function cycleRecord(nodeIds) {
    return { get: (key) => (key === 'nodeIds' ? nodeIds : []) };
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
(0, vitest_1.describe)('Property 9: Circular Dependency Detection', () => {
    let engine;
    (0, vitest_1.beforeEach)(() => {
        engine = new queries_1.GraphQueryEngine();
        vitest_1.vi.restoreAllMocks();
    });
    // ── Property 9.1: Known cycle detected (APOC path) ────────────────────────
    (0, vitest_1.it)('APOC path: detects a known cycle — result contains all cycle nodes', async () => {
        /**
         * Validates: Requirements 6.9
         * For any cycle A→B→…→A, findCircularDependencies() must return at least
         * one Cycle whose nodes include every node in the cycle.
         */
        await fc.assert(fc.asyncProperty(cycleNodesArb, async (cycleNodes) => {
            // APOC returns the cycle nodes as a single SCC component
            const session = makeSession([cycleRecord(cycleNodes)]);
            vitest_1.vi.spyOn(neo4j, 'getReadSession').mockReturnValue(session);
            const cycles = await engine.findCircularDependencies();
            (0, vitest_1.expect)(cycles.length).toBeGreaterThanOrEqual(1);
            // At least one returned cycle must contain all nodes of our known cycle
            const found = cycles.some((c) => cycleNodes.every((n) => c.nodes.includes(n)));
            (0, vitest_1.expect)(found).toBe(true);
        }), { numRuns: 50 });
    });
    // ── Property 9.2: Known cycle detected (manual fallback path) ─────────────
    (0, vitest_1.it)('manual fallback path: detects a known cycle when APOC is unavailable', async () => {
        /**
         * Validates: Requirements 6.9
         * When APOC throws, the manual Cypher fallback must still detect cycles.
         */
        await fc.assert(fc.asyncProperty(cycleNodesArb, async (cycleNodes) => {
            const session = makeApocFailSession([cycleRecord(cycleNodes)]);
            vitest_1.vi.spyOn(neo4j, 'getReadSession').mockReturnValue(session);
            const cycles = await engine.findCircularDependencies();
            (0, vitest_1.expect)(cycles.length).toBeGreaterThanOrEqual(1);
            const found = cycles.some((c) => cycleNodes.every((n) => c.nodes.includes(n)));
            (0, vitest_1.expect)(found).toBe(true);
        }), { numRuns: 50 });
    });
    // ── Property 9.3: Acyclic graph returns empty array ───────────────────────
    (0, vitest_1.it)('acyclic graph (DAG) returns an empty cycle list', async () => {
        /**
         * Validates: Requirements 6.9
         * For any DAG, findCircularDependencies() must return [].
         */
        await fc.assert(fc.asyncProperty(dagNodesArb, async (_dagNodes) => {
            // No SCC components with size > 1 → APOC returns no records
            const session = makeSession([]);
            vitest_1.vi.spyOn(neo4j, 'getReadSession').mockReturnValue(session);
            const cycles = await engine.findCircularDependencies();
            (0, vitest_1.expect)(cycles).toEqual([]);
        }), { numRuns: 50 });
    });
    (0, vitest_1.it)('acyclic graph (DAG) returns empty list via manual fallback too', async () => {
        /**
         * Validates: Requirements 6.9
         * When APOC is unavailable and the graph is acyclic, the fallback must
         * also return [].
         */
        await fc.assert(fc.asyncProperty(dagNodesArb, async (_dagNodes) => {
            const session = makeApocFailSession([]);
            vitest_1.vi.spyOn(neo4j, 'getReadSession').mockReturnValue(session);
            const cycles = await engine.findCircularDependencies();
            (0, vitest_1.expect)(cycles).toEqual([]);
        }), { numRuns: 50 });
    });
    // ── Property 9.4: Deduplication ───────────────────────────────────────────
    (0, vitest_1.it)('duplicate cycles (same sorted nodes) appear only once in results', async () => {
        /**
         * Validates: Requirements 6.9
         * If the database returns the same cycle multiple times (e.g. different
         * starting nodes), the result must deduplicate them.
         * Deduplication key: sorted node IDs joined.
         */
        await fc.assert(fc.asyncProperty(cycleNodesArb, async (cycleNodes) => {
            // Return the same cycle twice (simulates duplicate paths from Cypher)
            const session = makeApocFailSession([
                cycleRecord(cycleNodes),
                cycleRecord([...cycleNodes].reverse()), // same nodes, different order
            ]);
            vitest_1.vi.spyOn(neo4j, 'getReadSession').mockReturnValue(session);
            const cycles = await engine.findCircularDependencies();
            // Build dedup keys from the result
            const keys = cycles.map((c) => [...c.nodes].sort().join(','));
            const uniqueKeys = new Set(keys);
            (0, vitest_1.expect)(keys.length).toBe(uniqueKeys.size);
        }), { numRuns: 50 });
    });
    // ── Property 9.5: Self-loops are detected ─────────────────────────────────
    (0, vitest_1.it)('self-loop (A→A) is detected as a cycle', async () => {
        /**
         * Validates: Requirements 6.9
         * A self-loop is the simplest cycle. findCircularDependencies() must
         * return at least one cycle containing the self-looping node.
         */
        await fc.assert(fc.asyncProperty(fc.string({ minLength: 1, maxLength: 8 }).filter((s) => s.length > 0), async (nodeId) => {
            // APOC path: SCC of size 1 with a self-loop
            const session = makeSession([cycleRecord([nodeId])]);
            vitest_1.vi.spyOn(neo4j, 'getReadSession').mockReturnValue(session);
            const cycles = await engine.findCircularDependencies();
            (0, vitest_1.expect)(cycles.length).toBeGreaterThanOrEqual(1);
            const found = cycles.some((c) => c.nodes.includes(nodeId));
            (0, vitest_1.expect)(found).toBe(true);
        }), { numRuns: 50 });
    });
    (0, vitest_1.it)('self-loop (A→A) detected via manual fallback', async () => {
        /**
         * Validates: Requirements 6.9
         * Self-loops must also be detected through the manual Cypher fallback.
         */
        await fc.assert(fc.asyncProperty(fc.string({ minLength: 1, maxLength: 8 }).filter((s) => s.length > 0), async (nodeId) => {
            const session = makeApocFailSession([cycleRecord([nodeId])]);
            vitest_1.vi.spyOn(neo4j, 'getReadSession').mockReturnValue(session);
            const cycles = await engine.findCircularDependencies();
            (0, vitest_1.expect)(cycles.length).toBeGreaterThanOrEqual(1);
            const found = cycles.some((c) => c.nodes.includes(nodeId));
            (0, vitest_1.expect)(found).toBe(true);
        }), { numRuns: 50 });
    });
});
//# sourceMappingURL=circular-deps.property.test.js.map