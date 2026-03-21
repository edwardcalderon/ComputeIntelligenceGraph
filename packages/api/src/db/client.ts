/**
 * Database client setup.
 *
 * Detects DATABASE_URL prefix:
 *   - starts with "postgres" → PostgreSQL via `pg` Pool
 *   - otherwise             → SQLite via `better-sqlite3`
 *
 * Exports a single `query(sql, params?)` function that works for both.
 */

const DATABASE_URL = process.env['DATABASE_URL'] ?? '';

// ---------------------------------------------------------------------------
// Shared query result type
// ---------------------------------------------------------------------------

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

// ---------------------------------------------------------------------------
// Driver implementations (loaded lazily to avoid importing unused drivers)
// ---------------------------------------------------------------------------

type QueryFn = <T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
) => Promise<QueryResult<T>>;

let _query: QueryFn | null = null;

function buildPostgresQuery(): QueryFn {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg') as typeof import('pg');
  const pool = new Pool({ connectionString: DATABASE_URL });

  return async <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> => {
    const result = await pool.query<T>(sql, params);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  };
}

function buildSqliteQuery(): QueryFn {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3') as typeof import('better-sqlite3');
  const dbPath = DATABASE_URL.replace(/^sqlite:\/\//, '') || ':memory:';
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');

  return async <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> => {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
      const rows = db.prepare(sql).all(...(params ?? [])) as T[];
      return { rows, rowCount: rows.length };
    }
    const info = db.prepare(sql).run(...(params ?? []));
    return { rows: [], rowCount: info.changes };
  };
}

function getQuery(): QueryFn {
  if (!_query) {
    _query = DATABASE_URL.startsWith('postgres')
      ? buildPostgresQuery()
      : buildSqliteQuery();
  }
  return _query;
}

/**
 * Execute a SQL query against the configured database.
 *
 * @param sql    Parameterised SQL string (use $1/$2/... for pg, ? for sqlite)
 * @param params Positional parameter values
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getQuery()<T>(sql, params);
}

/**
 * Run the SQL migration file against the current database.
 * Reads the file at the given path and executes it as a single statement batch.
 */
export async function runMigration(sql: string): Promise<void> {
  // Split on statement boundaries and run each non-empty statement
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await query(stmt);
  }
}
