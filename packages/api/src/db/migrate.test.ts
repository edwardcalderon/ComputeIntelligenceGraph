import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase } from './client.js';

describe('db migration runner', () => {
  let tempDir: string;
  let migrationsDir: string;
  let databasePath: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'cig-api-migrate-'));
    migrationsDir = path.join(tempDir, 'migrations');
    databasePath = path.join(tempDir, 'test.sqlite');

    await writeFile(
      path.join(tempDir, 'placeholder'),
      'tmp',
      'utf8'
    );
  });

  afterEach(async () => {
    await closeDatabase();
    process.env = originalEnv;
    vi.resetModules();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  async function prepareMigrations(): Promise<void> {
    await writeFile(
      path.join(migrationsDir, '001_create_widgets.sql'),
      `
      CREATE TABLE widgets (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
      `,
      'utf8'
    ).catch(async () => {
      await import('node:fs/promises').then(({ mkdir }) =>
        mkdir(migrationsDir, { recursive: true })
      );
      await writeFile(
        path.join(migrationsDir, '001_create_widgets.sql'),
        `
        CREATE TABLE widgets (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        );
        `,
        'utf8'
      );
    });

    await writeFile(
      path.join(migrationsDir, '002_seed_widgets.sql'),
      `
      INSERT INTO widgets (id, name) VALUES (1, 'alpha');
      INSERT INTO widgets (id, name) VALUES (2, 'beta');
      `,
      'utf8'
    );
  }

  it('applies migrations from an empty database and records migration state', async () => {
    process.env.DATABASE_URL = `sqlite://${databasePath}`;
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(migrationsDir, { recursive: true })
    );
    await prepareMigrations();
    vi.resetModules();

    const [{ applyMigrations }, { query }] = await Promise.all([
      import('./migrate.js'),
      import('./client.js'),
    ]);

    const result = await applyMigrations({ directory: migrationsDir });

    expect(result.applied).toEqual([
      '001_create_widgets.sql',
      '002_seed_widgets.sql',
    ]);
    expect(result.skipped).toEqual([]);

    const widgets = await query<{ id: number; name: string }>(
      'SELECT id, name FROM widgets ORDER BY id'
    );
    expect(widgets.rows).toEqual([
      { id: 1, name: 'alpha' },
      { id: 2, name: 'beta' },
    ]);

    const migrations = await query<{ name: string }>(
      'SELECT name FROM schema_migrations ORDER BY name'
    );
    expect(migrations.rows).toEqual([
      { name: '001_create_widgets.sql' },
      { name: '002_seed_widgets.sql' },
    ]);
  });

  it('is idempotent when run multiple times', async () => {
    process.env.DATABASE_URL = `sqlite://${databasePath}`;
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(migrationsDir, { recursive: true })
    );
    await prepareMigrations();
    vi.resetModules();

    const [{ applyMigrations }, { query }] = await Promise.all([
      import('./migrate.js'),
      import('./client.js'),
    ]);

    const firstRun = await applyMigrations({ directory: migrationsDir });
    const secondRun = await applyMigrations({ directory: migrationsDir });

    expect(firstRun.applied).toHaveLength(2);
    expect(secondRun.applied).toEqual([]);
    expect(secondRun.skipped).toEqual([
      '001_create_widgets.sql',
      '002_seed_widgets.sql',
    ]);

    const widgetCount = await query<{ count: number }>(
      'SELECT COUNT(*) AS count FROM widgets'
    );
    expect(widgetCount.rows[0]?.count).toBe(2);
  });

  it('normalizes postgres-only migration syntax for sqlite installs', async () => {
    process.env.DATABASE_URL = `sqlite://${databasePath}`;
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(migrationsDir, { recursive: true })
    );

    await writeFile(
      path.join(migrationsDir, '001_sqlite_compat.sql'),
      `
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE widgets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE POLICY "widgets_select" ON widgets FOR SELECT USING (true);
      `,
      'utf8'
    );

    vi.resetModules();

    const [{ applyMigrations }, { query }] = await Promise.all([
      import('./migrate.js'),
      import('./client.js'),
    ]);

    const result = await applyMigrations({ directory: migrationsDir });

    expect(result.applied).toEqual(['001_sqlite_compat.sql']);
    expect(result.skipped).toEqual([]);

    await query('INSERT INTO widgets DEFAULT VALUES');

    const widgets = await query<{ id: string; payload: string; created_at: string }>(
      'SELECT id, payload, created_at FROM widgets'
    );

    expect(widgets.rows).toHaveLength(1);
    expect(widgets.rows[0]?.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(widgets.rows[0]?.payload).toBe('{}');
    expect(widgets.rows[0]?.created_at).toBeTruthy();
  });

  it('allows legacy node onboarding checksums to upgrade through the new managed_nodes timestamp migration', async () => {
    process.env.DATABASE_URL = `sqlite://${databasePath}`;
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(migrationsDir, { recursive: true })
    );

    await writeFile(
      path.join(migrationsDir, '004_cig_node_onboarding.sql'),
      `
      CREATE TABLE managed_nodes (
        id TEXT PRIMARY KEY
      );
      `,
      'utf8'
    );

    await writeFile(
      path.join(migrationsDir, '008_managed_nodes_updated_at.sql'),
      `
      ALTER TABLE managed_nodes ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
      `,
      'utf8'
    );

    vi.resetModules();

    const [{ applyMigrations }, { query }] = await Promise.all([
      import('./migrate.js'),
      import('./client.js'),
    ]);

    await query(`
      CREATE TABLE schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query('CREATE TABLE managed_nodes (id TEXT PRIMARY KEY)');
    await query('INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)', [
      '004_cig_node_onboarding.sql',
      '799a1b3f',
    ]);

    const result = await applyMigrations({ directory: migrationsDir });

    expect(result.applied).toEqual(['008_managed_nodes_updated_at.sql']);
    expect(result.skipped).toEqual(['004_cig_node_onboarding.sql']);

    await query('INSERT INTO managed_nodes (id) VALUES (?)', ['node-1']);

    const nodes = await query<{ id: string; updated_at: string }>(
      'SELECT id, updated_at FROM managed_nodes'
    );

    expect(nodes.rows).toEqual([
      {
        id: 'node-1',
        updated_at: expect.any(String),
      },
    ]);
  });
});
