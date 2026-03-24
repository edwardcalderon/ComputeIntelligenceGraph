import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { QueryResultRow } from 'pg';
import { isPostgresDatabase, query, runMigration, withTransaction } from './client.js';

export interface AppliedMigrationRow extends QueryResultRow {
  name: string;
  checksum: string;
}

export interface MigrationRunResult {
  applied: string[];
  skipped: string[];
}

export interface ApplyMigrationsOptions {
  directory?: string;
}

const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export function resolveMigrationsDirectory(directory?: string): string {
  return directory ? path.resolve(directory) : DEFAULT_MIGRATIONS_DIR;
}

export async function listMigrationFiles(directory?: string): Promise<string[]> {
  const migrationsDir = resolveMigrationsDirectory(directory);
  const entries = await readdir(migrationsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export async function ensureSchemaMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name         TEXT PRIMARY KEY,
      checksum     TEXT NOT NULL,
      applied_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function buildChecksum(sql: string): string {
  let hash = 0;
  for (let index = 0; index < sql.length; index += 1) {
    hash = (hash * 31 + sql.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export async function applyMigrations(
  options: ApplyMigrationsOptions = {}
): Promise<MigrationRunResult> {
  const migrationsDir = resolveMigrationsDirectory(options.directory);
  const migrationFiles = await listMigrationFiles(migrationsDir);
  const applied: string[] = [];
  const skipped: string[] = [];
  const usesPostgres = isPostgresDatabase();
  const selectMigrationSql = usesPostgres
    ? 'SELECT name, checksum FROM schema_migrations WHERE name = $1'
    : 'SELECT name, checksum FROM schema_migrations WHERE name = ?';
  const insertMigrationSql = usesPostgres
    ? 'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)'
    : 'INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)';

  await ensureSchemaMigrationsTable();

  for (const fileName of migrationFiles) {
    const fullPath = path.join(migrationsDir, fileName);
    const sql = await readFile(fullPath, 'utf8');
    const checksum = buildChecksum(sql);

    const existing = await query<AppliedMigrationRow>(selectMigrationSql, [fileName]);

    if (existing.rowCount > 0) {
      const appliedMigration = existing.rows[0]!;
      if (appliedMigration.checksum !== checksum) {
        throw new Error(
          `Migration checksum mismatch for ${fileName}. Existing checksum ${appliedMigration.checksum} does not match ${checksum}.`
        );
      }
      skipped.push(fileName);
      continue;
    }

    await withTransaction(async (txQuery) => {
      await runMigration(sql, txQuery);

      await txQuery(insertMigrationSql, [fileName, checksum]);
    });

    applied.push(fileName);
  }

  return { applied, skipped };
}
