import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { seedSelfHostedBootstrapTokens } from '../bootstrap/self-hosted-bootstrap';
import type { FastifyBaseLogger } from 'fastify';

let dbQuery: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} satisfies Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>;

beforeAll(async () => {
  process.env['DATABASE_URL'] = 'sqlite://:memory:';
  process.env['CIG_AUTH_MODE'] = 'self-hosted';

  const clientModule = await import('../db/client');
  dbQuery = clientModule.query;

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS bootstrap_tokens (
      token      TEXT PRIMARY KEY,
      expires_at TEXT NOT NULL,
      consumed   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS bootstrap_token_records (
      id                TEXT PRIMARY KEY,
      token_hash        TEXT NOT NULL,
      first_accessed_at TEXT,
      used_at           TEXT,
      expires_at        TEXT NOT NULL,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS admin_accounts (
      id            TEXT PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
});

beforeEach(async () => {
  process.env['CIG_BOOTSTRAP_TOKEN'] = 'a'.repeat(32);
  await dbQuery('DELETE FROM bootstrap_tokens');
  await dbQuery('DELETE FROM bootstrap_token_records');
  await dbQuery('DELETE FROM admin_accounts');
  logger.info.mockClear();
  logger.warn.mockClear();
  logger.error.mockClear();
});

afterAll(() => {
  delete process.env['CIG_BOOTSTRAP_TOKEN'];
});

describe('seedSelfHostedBootstrapTokens', () => {
  it('seeds legacy and node bootstrap token tables when no admin account exists', async () => {
    const rawToken = process.env['CIG_BOOTSTRAP_TOKEN']!;

    await seedSelfHostedBootstrapTokens(logger);

    const legacyResult = await dbQuery(
      `SELECT token, expires_at, consumed, created_at FROM bootstrap_tokens WHERE token = ?`,
      [rawToken]
    );
    expect(legacyResult.rowCount).toBe(1);

    const legacyRow = legacyResult.rows[0] as Record<string, unknown>;
    expect(legacyRow['token']).toBe(rawToken);
    expect(legacyRow['consumed']).toBe(0);

    const nodeResult = await dbQuery(
      `SELECT token_hash, first_accessed_at, used_at, expires_at FROM bootstrap_token_records`
    );
    expect(nodeResult.rowCount).toBe(1);

    const nodeRow = nodeResult.rows[0] as Record<string, unknown>;
    expect(nodeRow['first_accessed_at']).toBeNull();
    expect(nodeRow['used_at']).toBeNull();
    expect(typeof nodeRow['token_hash']).toBe('string');
    expect(await bcrypt.compare(rawToken, String(nodeRow['token_hash']))).toBe(true);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        seededTables: ['bootstrap_tokens', 'bootstrap_token_records'],
      }),
      'Seeded self-hosted bootstrap token records from the configured install token'
    );
  });

  it('skips seeding when an admin account already exists', async () => {
    await dbQuery(
      `INSERT INTO admin_accounts (id, username, email, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      ['admin-id', 'admin', 'admin@example.com', 'hashed', new Date().toISOString()]
    );

    await seedSelfHostedBootstrapTokens(logger);

    const legacyResult = await dbQuery(`SELECT COUNT(*) AS count FROM bootstrap_tokens`);
    const nodeResult = await dbQuery(`SELECT COUNT(*) AS count FROM bootstrap_token_records`);

    expect(Number((legacyResult.rows[0] as Record<string, unknown>)['count'] ?? 0)).toBe(0);
    expect(Number((nodeResult.rows[0] as Record<string, unknown>)['count'] ?? 0)).toBe(0);
    expect(logger.info).not.toHaveBeenCalled();
  });
});
