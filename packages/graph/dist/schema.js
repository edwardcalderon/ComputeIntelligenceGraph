"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySchema = applySchema;
// DDL statements for Neo4j 5.x schema setup
const CONSTRAINTS = [
    // Unique constraint on Resource.id
    `CREATE CONSTRAINT resource_id IF NOT EXISTS
   FOR (r:Resource) REQUIRE r.id IS UNIQUE`,
];
const INDEXES = [
    // Single-property indexes
    `CREATE INDEX resource_type IF NOT EXISTS
   FOR (r:Resource) ON (r.type)`,
    `CREATE INDEX resource_provider IF NOT EXISTS
   FOR (r:Resource) ON (r.provider)`,
    `CREATE INDEX resource_state IF NOT EXISTS
   FOR (r:Resource) ON (r.state)`,
    `CREATE INDEX resource_region IF NOT EXISTS
   FOR (r:Resource) ON (r.region)`,
    `CREATE INDEX resource_name IF NOT EXISTS
   FOR (r:Resource) ON (r.name)`,
    // Composite indexes for common query patterns
    `CREATE INDEX resource_type_provider IF NOT EXISTS
   FOR (r:Resource) ON (r.type, r.provider)`,
    `CREATE INDEX resource_provider_region IF NOT EXISTS
   FOR (r:Resource) ON (r.provider, r.region)`,
    `CREATE INDEX resource_state_type IF NOT EXISTS
   FOR (r:Resource) ON (r.state, r.type)`,
];
const FULLTEXT_INDEXES = [
    // Full-text search index for resource search
    `CREATE FULLTEXT INDEX resource_search IF NOT EXISTS
   FOR (r:Resource) ON EACH [r.name, r.type, r.provider, r.region]`,
];
/**
 * Applies all constraints and indexes to the Neo4j database.
 * Safe to call multiple times — all statements use IF NOT EXISTS.
 */
async function applySchema(session) {
    const statements = [...CONSTRAINTS, ...INDEXES, ...FULLTEXT_INDEXES];
    for (const statement of statements) {
        await session.run(statement);
    }
}
//# sourceMappingURL=schema.js.map