import { Driver, Session } from 'neo4j-driver';
/**
 * Returns the singleton Neo4j driver, creating it on first call.
 */
export declare function getDriver(): Driver;
/**
 * Opens a read session against the configured database.
 */
export declare function getReadSession(): Session;
/**
 * Opens a write session against the configured database.
 */
export declare function getWriteSession(): Session;
/**
 * Verifies connectivity to Neo4j. Resolves true on success, throws on failure.
 */
export declare function verifyConnectivity(): Promise<boolean>;
/**
 * Closes the driver and releases all pooled connections.
 */
export declare function closeDriver(): Promise<void>;
//# sourceMappingURL=neo4j.d.ts.map