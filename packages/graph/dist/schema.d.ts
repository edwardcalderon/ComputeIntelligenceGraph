import type { Session } from 'neo4j-driver';
/**
 * Applies all constraints and indexes to the Neo4j database.
 * Safe to call multiple times — all statements use IF NOT EXISTS.
 */
export declare function applySchema(session: Session): Promise<void>;
//# sourceMappingURL=schema.d.ts.map