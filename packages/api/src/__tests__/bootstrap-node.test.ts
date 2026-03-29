import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createServer } from '../index';

let app: FastifyInstance;
let dbQuery: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;

beforeAll(async () => {
  process.env['DATABASE_URL'] = 'sqlite://:memory:';
  process.env['JWT_SECRET'] = 'test-secret-for-bootstrap-node-tests-at-least-32!!';
  process.env['CIG_AUTH_MODE'] = 'self-hosted';

  app = await createServer();

  const clientModule = await import('../db/client');
  dbQuery = clientModule.query;

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

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await dbQuery('DELETE FROM bootstrap_token_records');
  await dbQuery('DELETE FROM admin_accounts');
});

async function insertBootstrapToken(rawToken: string, expired = false): Promise<void> {
  const tokenHash = await bcrypt.hash(rawToken, 4);
  await dbQuery(
    `INSERT INTO bootstrap_token_records (id, token_hash, used_at, expires_at, created_at)
     VALUES (?, ?, NULL, ?, ?)`,
    [
      crypto.randomUUID(),
      tokenHash,
      expired
        ? new Date(Date.now() - 1000).toISOString()
        : new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      new Date().toISOString(),
    ]
  );
}

describe('GET /api/v1/bootstrap/node/status', () => {
  it('returns requires_bootstrap: true and mode: self-hosted when no admin exists', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/bootstrap/node/status',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      requires_bootstrap: true,
      mode: 'self-hosted',
    });
  });
});

describe('POST /api/v1/bootstrap/node/complete', () => {
  it('creates an admin account and returns an access token', async () => {
    const token = 'node-bootstrap-token-0000000000000001';
    await insertBootstrapToken(token);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bootstrap/node/complete',
      payload: {
        bootstrap_token: token,
        username: 'admin-node',
        email: 'admin-node@example.com',
        password: 'SecurePass123!',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{ access_token: string; adminId: string; message: string }>();
    expect(body.access_token).toBeTruthy();
    expect(body.adminId).toBeTruthy();
    expect(body.message).toContain('Bootstrap complete');

    const adminResult = await dbQuery(`SELECT COUNT(*) AS count FROM admin_accounts`);
    expect(Number((adminResult.rows[0] as Record<string, unknown>)['count'] ?? 0)).toBe(1);

    const tokenResult = await dbQuery(
      `SELECT used_at, first_accessed_at FROM bootstrap_token_records`
    );
    const tokenRow = tokenResult.rows[0] as Record<string, unknown>;
    expect(tokenRow['used_at']).toBeTruthy();
    expect(tokenRow['first_accessed_at']).toBeTruthy();
  });

  it('returns 409 when bootstrap has already been completed', async () => {
    await dbQuery(
      `INSERT INTO admin_accounts (id, username, email, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      ['admin-existing', 'existing', 'existing@example.com', 'hashed', new Date().toISOString()]
    );
    await insertBootstrapToken('node-bootstrap-token-0000000000000002');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bootstrap/node/complete',
      payload: {
        bootstrap_token: 'node-bootstrap-token-0000000000000002',
        username: 'admin-node-2',
        email: 'admin-node-2@example.com',
        password: 'SecurePass123!',
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json<{ code: string }>().code).toBe('bootstrap_already_complete');
  });
});
