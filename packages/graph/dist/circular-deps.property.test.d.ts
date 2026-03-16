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
export {};
//# sourceMappingURL=circular-deps.property.test.d.ts.map