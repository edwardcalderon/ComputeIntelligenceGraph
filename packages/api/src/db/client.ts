/**
 * Database client setup.
 *
 * Detects DATABASE_URL prefix:
 *   - starts with "postgres" → PostgreSQL via `pg` Pool
 *   - otherwise             → SQLite via `better-sqlite3`
 *
 * Exports a single `query(sql, params?)` function that works for both.
 */

import type { QueryResultRow } from "pg";

const DATABASE_URL = process.env['DATABASE_URL'] ?? '';

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
}

let _driver: DatabaseDriver | null = null;

function normalizeQueryResult<T extends QueryResultRow = QueryResultRow>(
  rows: T[],
  rowCount?: number | null
): QueryResult<T> {
  return { rows, rowCount: rowCount ?? rows.length };
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

function buildPostgresDriver(): DatabaseDriver {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg') as typeof import('pg');
  const pool = new Pool({ connectionString: DATABASE_URL });

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
  };
}

function buildSqliteDriver(): DatabaseDriver {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3') as typeof import('better-sqlite3');
  const dbPath = DATABASE_URL.replace(/^sqlite:\/\//, '') || ':memory:';
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
  };
}

function getDriver(): DatabaseDriver {
  if (!_driver) {
    _driver = DATABASE_URL.startsWith('postgres')
      ? buildPostgresDriver()
      : buildSqliteDriver();
  }
  return _driver;
}

export function isPostgresDatabase(): boolean {
  return DATABASE_URL.startsWith('postgres');
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
