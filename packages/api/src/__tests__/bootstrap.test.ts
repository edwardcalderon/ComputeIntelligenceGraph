/**
 * Unit tests for the bootstrap endpoints.
 *
 * Covers:
 *   - GET /bootstrap/status returns requires_bootstrap + mode in self-hosted and managed modes
 *   - GET /bootstrap/status returns requires_bootstrap: true with empty admin table
 *   - GET /bootstrap/status returns requires_bootstrap: false when admin exists
 *   - GET /bootstrap/node/status returns the same shape for the dashboard redirect
 *   - POST /bootstrap/validate: valid token, expired token, consumed token
 *   - POST /bootstrap/complete: success, password too short, token expired, token consumed
 *   - Localhost-only guard in self-hosted mode
 *
 * Requirement 15: API — Bootstrap Endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../index';

// ─── Setup ────────────────────────────────────────────────────────────────────

let app: FastifyInstance;
let dbQuery: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;

beforeAll(async () => {
  process.env['DATABASE_URL'] = 'sqlite://:memory:';
  process.env['JWT_SECRET'] = 'test-secret-for-bootstrap-unit-tests-at-least-32!!';
  process.env['CIG_AUTH_MODE'] = 'self-hosted';

  app = await createServer();

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
    CREATE TABLE IF NOT EXISTS admin_accounts (
      id            TEXT PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS audit_events (
      id         TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      actor      TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      outcome    TEXT NOT NULL,
      metadata   TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await dbQuery('DELETE FROM bootstrap_tokens');
  await dbQuery('DELETE FROM admin_accounts');
  await dbQuery('DELETE FROM audit_events');
});

afterEach(() => {
  process.env['CIG_AUTH_MODE'] = 'self-hosted';
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function futureExpiry(): string {
  return new Date(Date.now() + 30 * 60 * 1000).toISOString();
}

function pastExpiry(): string {
  return new Date(Date.now() - 1000).toISOString();
}

async function insertToken(token: string, consumed = false, expired = false): Promise<void> {
  const expiresAt = expired ? pastExpiry() : futureExpiry();
  await dbQuery(
    `INSERT INTO bootstrap_tokens (token, expires_at, consumed) VALUES (?, ?, ?)`,
    [token, expiresAt, consumed ? 1 : 0]
  );
}

// ─── GET /api/v1/bootstrap/status ─────────────────────────────────────────────

describe('GET /api/v1/bootstrap/status', () => {
  it('returns requires_bootstrap: true when admin_accounts table is empty', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/bootstrap/status',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ requires_bootstrap: boolean; mode: 'managed' | 'self-hosted' }>();
    expect(body.requires_bootstrap).toBe(true);
    expect(body.mode).toBe('self-hosted');
  });

  it('returns requires_bootstrap: false when at least one admin account exists', async () => {
    // Insert a dummy admin account
    await dbQuery(
      `INSERT INTO admin_accounts (id, username, email, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      ['admin-id-1', 'admin', 'admin@example.com', 'hashed', new Date().toISOString()]
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/bootstrap/status',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ requires_bootstrap: boolean; mode: 'managed' | 'self-hosted' }>();
    expect(body.requires_bootstrap).toBe(false);
    expect(body.mode).toBe('self-hosted');
  });

  it('returns mode: managed and requires_bootstrap: false in managed deployments', async () => {
    process.env['CIG_AUTH_MODE'] = 'managed';

    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/bootstrap/status',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ requires_bootstrap: boolean; mode: 'managed' | 'self-hosted' }>();
      expect(body.mode).toBe('managed');
      expect(body.requires_bootstrap).toBe(false);
    } finally {
      process.env['CIG_AUTH_MODE'] = 'self-hosted';
    }
  });
});

describe('GET /api/v1/bootstrap/node/status', () => {
  it('returns requires_bootstrap: true and mode: self-hosted when no admin exists', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/bootstrap/node/status',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ requires_bootstrap: boolean; mode: 'managed' | 'self-hosted' }>();
    expect(body.requires_bootstrap).toBe(true);
    expect(body.mode).toBe('self-hosted');
  });

  it('returns requires_bootstrap: false when an admin account already exists', async () => {
    await dbQuery(
      `INSERT INTO admin_accounts (id, username, email, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      ['admin-id-node', 'admin-node', 'admin-node@example.com', 'hashed', new Date().toISOString()]
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/bootstrap/node/status',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ requires_bootstrap: boolean; mode: 'managed' | 'self-hosted' }>();
    expect(body.requires_bootstrap).toBe(false);
    expect(body.mode).toBe('self-hosted');
  });

  it('returns mode: managed and requires_bootstrap: false in managed deployments', async () => {
    process.env['CIG_AUTH_MODE'] = 'managed';

    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/bootstrap/node/status',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ requires_bootstrap: boolean; mode: 'managed' | 'self-hosted' }>();
      expect(body.mode).toBe('managed');
      expect(body.requires_bootstrap).toBe(false);
    } finally {
      process.env['CIG_AUTH_MODE'] = 'self-hosted';
    }
  });
});

// ─── POST /api/v1/bootstrap/validate ──────────────────────────────────────────

describe('POST /api/v1/bootstrap/validate', () => {
  it('returns { valid: true } for a valid, unconsumed, non-expired token', async () => {
    const token = 'a'.repeat(32);
    await insertToken(token);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bootstrap/validate',
      payload: { bootstrap_token: token },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ valid: true });
  });

  it('returns 401 for an unknown token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bootstrap/validate',
      payload: { bootstrap_token: 'nonexistent-token' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 409 bootstrap_already_complete for a consumed token', async () => {
    const token = 'b'.repeat(32);
    await insertToken(token, true);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bootstrap/validate',
      payload: { bootstrap_token: token },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json<{ code: string }>().code).toBe('bootstrap_already_complete');
  });

  it('returns 401 bootstrap_token_expired for an expired token', async () => {
    const token = 'c'.repeat(32);
    await insertToken(token, false, true);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bootstrap/validate',
      payload: { bootstrap_token: token },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('bootstrap_token_expired');
  });

  it('returns 400 when bootstrap_token is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bootstrap/validate',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});

// ─── POST /api/v1/bootstrap/complete ──────────────────────────────────────────

describe('POST /api/v1/bootstrap/complete', () => {
  it('creates admin account and returns access_token + refresh_token on success', async () => {
    const token = 'd'.repeat(32);
    await insertToken(token);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bootstrap/complete',
      payload: {
        bootstrap_token: token,
        username: 'admin',
        email: 'admin@example.com',
        password: 'SecurePass123!',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{ access_token: string; refresh_token: string }>();
    expect(body.access_token).toBeTruthy();
    expect(body.refresh_token).toBeTruthy();
  });

  it('returns 422 password_too_short when password has fewer than 12 characters', async () => {
    const token = 'e'.repeat(32);
    await insertToken(token);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bootstrap/complete',
      payload: {
        bootstrap_token: token,
        username: 'admin2',
        email: 'admin2@example.com',
        password: 'short',
      },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json<{ code: string }>().code).toBe('password_too_short');
  });

  it('returns 409 bootstrap_already_complete on second call with same token', async () => {
    const token = 'f'.repeat(32);
    await insertToken(token);

    const payload = {
      bootstrap_token: token,
      username: 'admin3',
      email: 'admin3@example.com',
      password: 'SecurePass123!',
    };

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/bootstrap/complete',
      payload,
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/bootstrap/complete',
      payload,
    });
    expect(second.statusCode).toBe(409);
    expect(second.json<{ code: string }>().code).toBe('bootstrap_already_complete');
  });

  it('returns 401 bootstrap_token_expired for an expired token', async () => {
    const token = '0'.repeat(32);
    await insertToken(token, false, true);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bootstrap/complete',
      payload: {
        bootstrap_token: token,
        username: 'admin4',
        email: 'admin4@example.com',
        password: 'SecurePass123!',
      },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('bootstrap_token_expired');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bootstrap/complete',
      payload: { bootstrap_token: 'sometoken' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('invalidates the token after successful bootstrap (status returns requires_bootstrap: false)', async () => {
    const token = '1'.repeat(32);
    await insertToken(token);

    await app.inject({
      method: 'POST',
      url: '/api/v1/bootstrap/complete',
      payload: {
        bootstrap_token: token,
        username: 'admin5',
        email: 'admin5@example.com',
        password: 'SecurePass123!',
      },
    });

    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/bootstrap/status',
    });

    expect(statusRes.statusCode).toBe(200);
    const statusBody = statusRes.json<{ requires_bootstrap: boolean; mode: 'managed' | 'self-hosted' }>();
    expect(statusBody.requires_bootstrap).toBe(false);
    expect(statusBody.mode).toBe('self-hosted');
  });
});

// ─── Localhost-only guard ──────────────────────────────────────────────────────

describe('Localhost-only guard (self-hosted mode)', () => {
  it('allows requests from 127.0.0.1 (default inject IP)', async () => {
    // Fastify inject uses 127.0.0.1 by default
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/bootstrap/status',
    });
    // Should not be 403
    expect(res.statusCode).not.toBe(403);
  });

  it('rejects requests from non-localhost IPs with 403 forbidden_origin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/bootstrap/status',
      headers: {
        'x-forwarded-for': '203.0.113.42',
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json<{ code: string }>().code).toBe('forbidden_origin');
  });
});
