import neo4j, { Driver, Session, SessionMode } from 'neo4j-driver';

// ─── Config ───────────────────────────────────────────────────────────────────

interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
  database: string;
  maxConnectionPoolSize: number;
}

function getConfig(): Neo4jConfig {
  return {
    uri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
    user: process.env.NEO4J_USER ?? 'neo4j',
    password: process.env.NEO4J_PASSWORD ?? 'neo4j',
    database: process.env.NEO4J_DATABASE ?? 'neo4j',
    maxConnectionPoolSize: 50,
  };
}

// ─── Singleton Driver ─────────────────────────────────────────────────────────

let _driver: Driver | null = null;

/**
 * Returns the singleton Neo4j driver, creating it on first call.
 */
export function getDriver(): Driver {
  if (!_driver) {
    const config = getConfig();
    _driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.user, config.password),
      {
        maxConnectionPoolSize: config.maxConnectionPoolSize,
        connectionAcquisitionTimeout: 30_000,
        maxTransactionRetryTime: 15_000,
        logging: neo4j.logging.console('warn'),
      }
    );
  }
  return _driver;
}

// ─── Session Helpers ──────────────────────────────────────────────────────────

/**
 * Opens a read session against the configured database.
 */
export function getReadSession(): Session {
  const config = getConfig();
  return getDriver().session({
    database: config.database,
    defaultAccessMode: neo4j.session.READ as SessionMode,
  });
}

/**
 * Opens a write session against the configured database.
 */
export function getWriteSession(): Session {
  const config = getConfig();
  return getDriver().session({
    database: config.database,
    defaultAccessMode: neo4j.session.WRITE as SessionMode,
  });
}

// ─── Health Check ─────────────────────────────────────────────────────────────

/**
 * Verifies connectivity to Neo4j. Resolves true on success, throws on failure.
 */
export async function verifyConnectivity(): Promise<boolean> {
  await getDriver().verifyConnectivity();
  return true;
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

/**
 * Closes the driver and releases all pooled connections.
 */
export async function closeDriver(): Promise<void> {
  if (_driver) {
    await _driver.close();
    _driver = null;
  }
}
