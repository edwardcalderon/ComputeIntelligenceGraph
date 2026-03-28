/**
 * Database client setup.
 *
 * Detects the configured database URL:
 *   - postgres:// / postgresql:// → PostgreSQL via `pg` Pool
 *   - sqlite://                  → SQLite via `better-sqlite3`
 *
 * There is no implicit SQLite fallback in managed production. SQLite is only
 * used when it is explicitly configured for offline/local relay mode or for
 * self-hosted/demo installs.
 *
 * Exports a single `query(sql, params?)` function that works for both.
 */

import type { QueryResultRow } from "pg";

// ---------------------------------------------------------------------------
// Shared query result type
// ---------------------------------------------------------------------------

export interface QueryResult<T extends QueryResultRow = QueryResultRow> {
  rows: T[];
  rowCount: number;
}

// ---------------------------------------------------------------------------
// Driver implementations (loaded lazily to avoid importing unused drivers)
// ---------------------------------------------------------------------------

type QueryFn = <T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
) => Promise<QueryResult<T>>;

interface DatabaseDriver {
  query: QueryFn;
  withTransaction<T>(fn: (query: QueryFn) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

let _driver: DatabaseDriver | null = null;

type DatabaseMode = 'postgres' | 'sqlite';

const SELF_HOSTED_SQLITE_FALLBACK_URL = 'sqlite:///var/lib/cig-node/cig.db';

function normalizeQueryResult<T extends QueryResultRow = QueryResultRow>(
  rows: T[],
  rowCount?: number | null
): QueryResult<T> {
  return { rows, rowCount: rowCount ?? rows.length };
}

function getDatabaseUrl(): string {
  const databaseUrl = process.env['DATABASE_URL']?.trim();
  if (databaseUrl) {
    return databaseUrl;
  }

  const poolerUrl = process.env['SUPABASE_DIRECT_URL_POOLER']?.trim();
  if (poolerUrl) {
    return poolerUrl;
  }

  if (process.env['CIG_AUTH_MODE'] === 'self-hosted' || process.env['CIG_DEMO_MODE'] === 'true') {
    return process.env['CIG_SELF_HOSTED_DATABASE_URL']?.trim() || SELF_HOSTED_SQLITE_FALLBACK_URL;
  }

  if (isProductionEnvironment()) {
    return '';
  }

  return process.env['SUPABASE_DIRECT_URL']?.trim() ?? '';
}

function isProductionEnvironment(): boolean {
  return process.env['NODE_ENV'] === 'production';
}

function allowsLocalSqliteInProduction(): boolean {
  return process.env['CIG_AUTH_MODE'] === 'self-hosted' || process.env['CIG_DEMO_MODE'] === 'true';
}

function isPostgresUrl(databaseUrl: string): boolean {
  return /^postgres(?:ql)?:\/\//.test(databaseUrl);
}

export interface PostgresPoolOptions {
  connectionString: string;
  family: 4;
}

export function resolvePostgresPoolOptions(databaseUrl: string): PostgresPoolOptions {
  return {
    connectionString: databaseUrl,
    // Supabase exposes AAAA records for direct Postgres hosts. Some runners and
    // local networks do not have IPv6 routing enabled, so pinning pg to IPv4
    // avoids ENETUNREACH while keeping Supabase as the primary database.
    family: 4,
  };
}

function isSqliteUrl(databaseUrl: string): boolean {
  return databaseUrl.startsWith('sqlite:');
}

function resolveDatabaseMode(databaseUrl: string): DatabaseMode {
  if (!databaseUrl) {
    throw new Error(
      'No database URL configured. Set DATABASE_URL or SUPABASE_DIRECT_URL_POOLER for production, ' +
        'SUPABASE_DIRECT_URL or SUPABASE_DIRECT_URL_POOLER for local Supabase development, or an explicit sqlite:// URL for offline relay mode. ' +
        'Self-hosted and demo installs default to sqlite:///var/lib/cig-node/cig.db when no database URL is supplied.'
    );
  }

  if (isPostgresUrl(databaseUrl)) {
    return 'postgres';
  }

  if (isSqliteUrl(databaseUrl)) {
    if (isProductionEnvironment() && !allowsLocalSqliteInProduction()) {
      throw new Error(
        'SQLite is not allowed in managed production. Set DATABASE_URL to the Supabase Postgres connection string.'
      );
    }
    return 'sqlite';
  }

  const scheme = databaseUrl.split(':', 1)[0] ?? 'unknown';
  throw new Error(
    `Unsupported database URL scheme "${scheme}". Use postgresql://... for Supabase or sqlite://... for offline relay mode.`
  );
}

export function translatePlaceholdersForPostgres(sql: string): string {
  let result = '';
  let placeholderIndex = 1;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]!;
    const next = sql[index + 1] ?? '';

    if (inLineComment) {
      result += char;
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      result += char;
      if (char === '*' && next === '/') {
        result += next;
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === '-' && next === '-') {
      result += char + next;
      index += 1;
      inLineComment = true;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === '/' && next === '*') {
      result += char + next;
      index += 1;
      inBlockComment = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      result += char;
      if (inSingleQuote && next === "'") {
        result += next;
        index += 1;
        continue;
      }

      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      result += char;
      if (inDoubleQuote && next === '"') {
        result += next;
        index += 1;
        continue;
      }

      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === '?') {
      result += `$${placeholderIndex}`;
      placeholderIndex += 1;
      continue;
    }

    result += char;
  }

  return result;
}

function buildPostgresDriver(databaseUrl: string): DatabaseDriver {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg') as typeof import('pg');
  const pool = new Pool(resolvePostgresPoolOptions(databaseUrl));

  const runQuery = async <T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> => {
    const result = await pool.query<T>(translatePlaceholdersForPostgres(sql), params);
    return normalizeQueryResult(result.rows, result.rowCount);
  };

  return {
    query: runQuery,
    async withTransaction<T>(fn: (query: QueryFn) => Promise<T>): Promise<T> {
      const client = await pool.connect();

      const txQuery: QueryFn = async <TRow extends QueryResultRow = QueryResultRow>(
        sql: string,
        params?: unknown[]
      ): Promise<QueryResult<TRow>> => {
        const result = await client.query<TRow>(translatePlaceholdersForPostgres(sql), params);
        return normalizeQueryResult(result.rows, result.rowCount);
      };

      try {
        await client.query('BEGIN');
        const result = await fn(txQuery);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Ignore rollback failures and rethrow the original error.
        }
        throw error;
      } finally {
        client.release();
      }
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}

function buildSqliteDriver(databaseUrl: string): DatabaseDriver {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3') as typeof import('better-sqlite3');
  const dbPath = databaseUrl.replace(/^sqlite:\/\//, '') || ':memory:';
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');

  const runQuery = async <T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> => {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH') || trimmed.startsWith('PRAGMA')) {
      const rows = db.prepare(sql).all(...(params ?? [])) as T[];
      return normalizeQueryResult(rows, rows.length);
    }
    const info = db.prepare(sql).run(...(params ?? []));
    return normalizeQueryResult([], info.changes);
  };

  return {
    query: runQuery,
    async withTransaction<T>(fn: (query: QueryFn) => Promise<T>): Promise<T> {
      db.prepare('BEGIN').run();
      try {
        const result = await fn(runQuery);
        db.prepare('COMMIT').run();
        return result;
      } catch (error) {
        try {
          db.prepare('ROLLBACK').run();
        } catch {
          // Ignore rollback failures and rethrow the original error.
        }
        throw error;
      }
    },
    async close(): Promise<void> {
      db.close();
    },
  };
}

function getDriver(): DatabaseDriver {
  if (!_driver) {
    const databaseUrl = getDatabaseUrl();
    const mode = resolveDatabaseMode(databaseUrl);
    _driver = mode === 'postgres'
      ? buildPostgresDriver(databaseUrl)
      : buildSqliteDriver(databaseUrl);
  }
  return _driver;
}

export function isPostgresDatabase(): boolean {
  return resolveDatabaseMode(getDatabaseUrl()) === 'postgres';
}

export async function closeDatabase(): Promise<void> {
  if (!_driver) {
    return;
  }

  const driver = _driver;
  _driver = null;
  await driver.close();
}

/**
 * Execute a SQL query against the configured database.
 *
 * @param sql    Parameterised SQL string (use $1/$2/... for pg, ? for sqlite)
 * @param params Positional parameter values
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getDriver().query<T>(sql, params);
}

export async function withTransaction<T>(
  fn: (query: QueryFn) => Promise<T>
): Promise<T> {
  return getDriver().withTransaction(fn);
}

/**
 * Run the SQL migration file against the current database.
 * Reads the file at the given path and executes it as a single statement batch.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]!;
    const next = sql[index + 1] ?? '';

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === '-' && next === '-') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      const escaped = sql[index - 1] === '\\';
      if (!escaped) inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      const escaped = sql[index - 1] === '\\';
      if (!escaped) inDoubleQuote = !inDoubleQuote;
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const finalStatement = current.trim();
  if (finalStatement.length > 0) {
    statements.push(finalStatement);
  }

  return statements;
}

export async function runMigration(sql: string, executor: QueryFn = query): Promise<void> {
  // Split on statement boundaries and run each non-empty statement
  const statements = splitStatements(sql);

  for (const stmt of statements) {
    await executor(stmt);
  }
}
