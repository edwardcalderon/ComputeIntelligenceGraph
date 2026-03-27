"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphQueryEngine = void 0;
const neo4j_1 = require("./neo4j");
// ─── Constants ────────────────────────────────────────────────────────────────
const QUERY_TIMEOUT_MS = 30_000;
const MAX_DEPTH = 3;
const DEFAULT_LIMIT = 50;
// ─── Record Mapping ───────────────────────────────────────────────────────────
function toDate(value) {
    if (value instanceof Date)
        return value;
    if (typeof value === 'string')
        return new Date(value);
    return new Date();
}
function recordToResource(record) {
    return {
        id: record['id'],
        name: record['name'],
        type: record['type'],
        provider: record['provider'],
        region: record['region'],
        zone: record['zone'],
        state: record['state'],
        tags: record['tags'] ? JSON.parse(record['tags']) : {},
        metadata: record['metadata'] ? JSON.parse(record['metadata']) : {},
        cost: record['cost'] != null ? Number(record['cost']) : undefined,
        createdAt: toDate(record['createdAt']),
        updatedAt: toDate(record['updatedAt']),
        discoveredAt: toDate(record['discoveredAt']),
    };
}
function recordToRelationship(record) {
    const r = record;
    return {
        id: r['id'],
        type: r['type'],
        fromId: r['fromId'],
        toId: r['toId'],
        properties: r['properties'] ? JSON.parse(r['properties']) : {},
    };
}
// ─── Session Runner ───────────────────────────────────────────────────────────
async function runRead(fn) {
    const session = (0, neo4j_1.getReadSession)();
    try {
        return await fn(session);
    }
    finally {
        await session.close();
    }
}
// ─── GraphQueryEngine ─────────────────────────────────────────────────────────
class GraphQueryEngine {
    /**
     * Returns all resources that the given resource depends on, up to `depth` levels.
     * Depth is capped at 3. Requirements: 8.3, 8.4
     */
    async getDependencies(resourceId, depth = 1) {
        const cappedDepth = Math.min(Math.max(1, depth), MAX_DEPTH);
        return runRead(async (session) => {
            const result = await session.run(`MATCH (r:Resource {id: $id})-[:DEPENDS_ON|USES|CONNECTS_TO*1..$depth]->(dep:Resource)
         RETURN DISTINCT properties(dep) AS dep`, { id: resourceId, depth: cappedDepth }, { timeout: QUERY_TIMEOUT_MS });
            return result.records.map((rec) => recordToResource(rec.get('dep')));
        });
    }
    /**
     * Returns all resources that depend on the given resource, up to `depth` levels.
     * Requirements: 8.5
     */
    async getDependents(resourceId, depth = 1) {
        const cappedDepth = Math.min(Math.max(1, depth), MAX_DEPTH);
        return runRead(async (session) => {
            const result = await session.run(`MATCH (dep:Resource)-[:DEPENDS_ON|USES|CONNECTS_TO*1..$depth]->(r:Resource {id: $id})
         RETURN DISTINCT properties(dep) AS dep`, { id: resourceId, depth: cappedDepth }, { timeout: QUERY_TIMEOUT_MS });
            return result.records.map((rec) => recordToResource(rec.get('dep')));
        });
    }
    /**
     * Returns resources that no other resource depends on (leaf/orphan resources).
     * Requirements: 8.6
     */
    async findUnusedResources() {
        return runRead(async (session) => {
            const result = await session.run(`MATCH (r:Resource)
         WHERE NOT ()-[:DEPENDS_ON|USES|CONNECTS_TO]->(r)
         RETURN properties(r) AS r`, {}, { timeout: QUERY_TIMEOUT_MS });
            return result.records.map((rec) => recordToResource(rec.get('r')));
        });
    }
    /**
     * Detects circular dependency cycles in the graph.
     * Uses manual Cypher cycle detection via path matching.
     * Requirements: 8.7
     */
    async findCircularDependencies() {
        return runRead(async (session) => {
            // Try APOC SCC first, fall back to manual Cypher detection
            try {
                const result = await session.run(`CALL apoc.algo.scc() YIELD nodes
           WHERE size(nodes) > 1
           RETURN [n IN nodes | n.id] AS nodeIds`, {}, { timeout: QUERY_TIMEOUT_MS });
                return result.records.map((rec) => {
                    const nodeIds = rec.get('nodeIds');
                    return {
                        nodes: nodeIds,
                        edges: [],
                    };
                });
            }
            catch {
                // APOC not available — use manual Cypher cycle detection
                const result = await session.run(`MATCH path = (r:Resource)-[:DEPENDS_ON|USES|CONNECTS_TO*2..${MAX_DEPTH}]->(r)
           RETURN [n IN nodes(path) | n.id] AS nodeIds,
                  [rel IN relationships(path) | type(rel)] AS edgeTypes`, {}, { timeout: QUERY_TIMEOUT_MS });
                const seen = new Set();
                const cycles = [];
                for (const rec of result.records) {
                    const nodeIds = rec.get('nodeIds');
                    const edgeTypes = rec.get('edgeTypes');
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
    async searchResources(query) {
        return runRead(async (session) => {
            const result = await session.run(`CALL db.index.fulltext.queryNodes('resource_search', $query) YIELD node
         RETURN properties(node) AS r`, { query }, { timeout: QUERY_TIMEOUT_MS });
            return result.records.map((rec) => recordToResource(rec.get('r')));
        });
    }
    /**
     * Lists resources with optional filters and pagination.
     * Requirements: 8.9, 8.10, 24.8
     */
    async listResourcesPaged(filters, pagination) {
        const limit = pagination?.limit ?? DEFAULT_LIMIT;
        const offset = pagination?.offset ?? 0;
        return runRead(async (session) => {
            const conditions = [];
            const params = { limit, offset };
            if (filters?.type) {
                conditions.push('r.type = $type');
                params['type'] = filters.type;
            }
            if (filters?.provider) {
                conditions.push('r.provider = $provider');
                params['provider'] = filters.provider;
            }
            if (filters?.region) {
                conditions.push('r.region = $region');
                params['region'] = filters.region;
            }
            if (filters?.state) {
                conditions.push('r.state = $state');
                params['state'] = filters.state;
            }
            const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            // Neo4j sessions execute queries serially; parallel `session.run()` calls on the
            // same session can fail in production even when tests mock the driver.
            const countResult = await session.run(`MATCH (r:Resource) ${where} RETURN count(r) AS total`, params, { timeout: QUERY_TIMEOUT_MS });
            const dataResult = await session.run(`MATCH (r:Resource) ${where} RETURN properties(r) AS r ORDER BY r.name SKIP $offset LIMIT $limit`, params, { timeout: QUERY_TIMEOUT_MS });
            const total = countResult.records[0]?.get('total');
            const totalCount = typeof total === 'object' && total !== null && 'toNumber' in total
                ? total.toNumber()
                : Number(total ?? 0);
            let resources = dataResult.records.map((rec) => recordToResource(rec.get('r')));
            // Tag filtering done in-memory (tags stored as JSON string)
            if (filters?.tags) {
                const tagEntries = Object.entries(filters.tags);
                resources = resources.filter((res) => tagEntries.every(([k, v]) => res.tags[k] === v));
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
    async getResourceCounts() {
        return runRead(async (session) => {
            const result = await session.run(`MATCH (r:Resource) RETURN r.type AS type, count(r) AS count`, {}, { timeout: QUERY_TIMEOUT_MS });
            const counts = {};
            for (const rec of result.records) {
                const type = rec.get('type');
                const count = rec.get('count');
                counts[type] = typeof count === 'object' && count !== null && 'toNumber' in count
                    ? count.toNumber()
                    : Number(count);
            }
            return counts;
        });
    }
    /**
     * Returns all relationships in the graph, capped by `limit`.
     * Requirements: 8.9, 24.8
     */
    async listRelationships(limit = DEFAULT_LIMIT) {
        const cappedLimit = Math.min(Math.max(1, limit), 1_000);
        return runRead(async (session) => {
            const result = await session.run(`MATCH (a:Resource)-[rel]->(b:Resource)
         RETURN rel.id AS id,
                type(rel) AS type,
                a.id AS fromId,
                b.id AS toId,
                rel.properties AS properties
         ORDER BY type(rel), a.id, b.id
         LIMIT $limit`, { limit: cappedLimit }, { timeout: QUERY_TIMEOUT_MS });
            return result.records.map((rec) => recordToRelationship({
                id: rec.get('id'),
                type: rec.get('type'),
                fromId: rec.get('fromId'),
                toId: rec.get('toId'),
                properties: rec.get('properties'),
            }));
        });
    }
}
exports.GraphQueryEngine = GraphQueryEngine;
//# sourceMappingURL=queries.js.map