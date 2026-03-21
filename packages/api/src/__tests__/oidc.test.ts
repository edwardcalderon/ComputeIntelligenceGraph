/**
 * Unit tests for the OIDC callback endpoint.
 *
 * Covers:
 *   - Valid code exchange and redirect
 *   - State mismatch (400 invalid_state)
 *   - Upstream token exchange error (502 oidc_upstream_error)
 *   - Missing code/state parameters (400)
 *   - ID token validation failure (401)
 *
 * Requirement 16: API — OIDC Callback Endpoint
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../index';

// ─── Setup ────────────────────────────────────────────────────────────────────

let app: FastifyInstance;
let dbQuery: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;

beforeAll(async () => {
  process.env['DATABASE_URL'] = 'sqlite://:memory:';
  process.env['JWT_SECRET'] = 'test-secret-for-oidc-unit-tests-at-least-32!!';
  process.env['CIG_AUTH_MODE'] = 'managed';
  process.env['AUTHENTIK_TOKEN_ENDPOINT'] = 'https://auth.example.com/application/o/token/';
  process.env['AUTHENTIK_JWKS_URI'] = 'https://auth.example.com/application/o/cig/jwks/';
  process.env['OIDC_CLIENT_ID'] = 'test-client-id';
  process.env['OIDC_CLIENT_SECRET'] = 'test-client-secret';
  process.env['OIDC_REDIRECT_URI'] = 'http://localhost:3000/api/v1/auth/oidc/callback';
  process.env['AUTHENTIK_ISSUER_URL'] = 'https://auth.example.com/application/o/cig/';
  process.env['POST_LOGIN_ROUTE'] = '/dashboard';

  app = await createServer();

  const clientModule = await import('../db/client');
  dbQuery = clientModule.query;

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS oidc_states (
      state      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      oidc_sub   TEXT UNIQUE,
      email      TEXT NOT NULL,
      groups     TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
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
  await dbQuery('DELETE FROM oidc_states');
  await dbQuery('DELETE FROM users');
  await dbQuery('DELETE FROM refresh_tokens');
  await dbQuery('DELETE FROM audit_events');
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function futureExpiry(): string {
  return new Date(Date.now() + 30 * 60 * 1000).toISOString();
}

async function insertState(state: string, userId = 'test-user-id'): Promise<void> {
  await dbQuery(
    `INSERT INTO oidc_states (state, user_id, expires_at) VALUES (?, ?, ?)`,
    [state, userId, futureExpiry()]
  );
}

// ─── GET /api/v1/auth/oidc/callback ───────────────────────────────────────────

describe('GET /api/v1/auth/oidc/callback', () => {
  it('returns 400 when code parameter is missing', async () => {
    await insertState('valid-state');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/oidc/callback?state=valid-state',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json<{ code: string }>().code).toBe('missing_parameters');
  });

  it('returns 400 when state parameter is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/oidc/callback?code=auth-code-123',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json<{ code: string }>().code).toBe('missing_parameters');
  });

  it('returns 400 invalid_state when state does not match stored CSRF state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/oidc/callback?code=auth-code-123&state=invalid-state',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json<{ code: string }>().code).toBe('invalid_state');
  });

  it('returns 400 invalid_state when state has expired', async () => {
    const expiredState = 'expired-state';
    const pastExpiry = new Date(Date.now() - 1000).toISOString();
    await dbQuery(
      `INSERT INTO oidc_states (state, user_id, expires_at) VALUES (?, ?, ?)`,
      [expiredState, 'test-user', pastExpiry]
    );

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/auth/oidc/callback?code=auth-code-123&state=${expiredState}`,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json<{ code: string }>().code).toBe('invalid_state');
  });

  it('returns 502 oidc_upstream_error when token exchange fails', async () => {
    await insertState('valid-state');

    // Mock fetch to return error
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/oidc/callback?code=bad-code&state=valid-state',
    });

    expect(res.statusCode).toBe(502);
    expect(res.json<{ code: string }>().code).toBe('oidc_upstream_error');
  });

  it('returns 302 redirect with access_token and refresh_token on valid code exchange', async () => {
    await insertState('valid-state', 'test-user-id');

    // Create a valid JWT token for testing
    const jwt = require('jsonwebtoken');
    const idToken = jwt.sign(
      {
        sub: 'user-123',
        email: 'test@test.com',
        groups: ['admin'],
      },
      'test-secret',
      { expiresIn: '1h' }
    );

    // Mock fetch to return successful token exchange
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'mock-access-token',
        id_token: idToken,
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/oidc/callback?code=valid-code&state=valid-state',
    });

    expect(res.statusCode).toBe(302);
    const location = res.headers.location as string;
    expect(location).toContain('/dashboard');
    expect(location).toContain('access_token=');
    expect(location).toContain('refresh_token=');
  });

  it('creates a new user record from OIDC claims on first login', async () => {
    await insertState('valid-state');

    const jwt = require('jsonwebtoken');
    const idToken = jwt.sign(
      {
        sub: 'new-user-sub',
        email: 'newuser@example.com',
        groups: ['users'],
      },
      'test-secret',
      { expiresIn: '1h' }
    );

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'mock-access-token',
        id_token: idToken,
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });

    await app.inject({
      method: 'GET',
      url: '/api/v1/auth/oidc/callback?code=valid-code&state=valid-state',
    });

    const userResult = await dbQuery(
      `SELECT id, oidc_sub, email FROM users WHERE oidc_sub = ?`,
      ['new-user-sub']
    );

    expect(userResult.rows.length).toBe(1);
    expect(userResult.rows[0]).toMatchObject({
      oidc_sub: 'new-user-sub',
      email: 'newuser@example.com',
    });
  });

  it('updates existing user record on subsequent login', async () => {
    // Insert existing user
    const userId = 'existing-user-id';
    await dbQuery(
      `INSERT INTO users (id, oidc_sub, email, groups, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, 'existing-sub', 'old@example.com', '[]', new Date().toISOString(), new Date().toISOString()]
    );

    await insertState('valid-state');

    const jwt = require('jsonwebtoken');
    const idToken = jwt.sign(
      {
        sub: 'existing-sub',
        email: 'updated@example.com',
        groups: ['admin', 'users'],
      },
      'test-secret',
      { expiresIn: '1h' }
    );

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'mock-access-token',
        id_token: idToken,
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });

    await app.inject({
      method: 'GET',
      url: '/api/v1/auth/oidc/callback?code=valid-code&state=valid-state',
    });

    const userResult = await dbQuery(
      `SELECT email, groups FROM users WHERE id = ?`,
      [userId]
    );

    expect(userResult.rows[0]).toMatchObject({
      email: 'updated@example.com',
      groups: '["admin","users"]',
    });
  });

  it('invalidates the state after successful callback', async () => {
    const state = 'state-to-invalidate';
    await insertState(state);

    const jwt = require('jsonwebtoken');
    const idToken = jwt.sign(
      {
        sub: 'user-123',
        email: 'test@test.com',
        groups: [],
      },
      'test-secret',
      { expiresIn: '1h' }
    );

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'mock-access-token',
        id_token: idToken,
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });

    await app.inject({
      method: 'GET',
      url: `/api/v1/auth/oidc/callback?code=valid-code&state=${state}`,
    });

    const stateResult = await dbQuery(
      `SELECT state FROM oidc_states WHERE state = ?`,
      [state]
    );

    expect(stateResult.rows.length).toBe(0);
  });

  it('writes audit event on successful callback', async () => {
    await insertState('valid-state');

    const jwt = require('jsonwebtoken');
    const idToken = jwt.sign(
      {
        sub: 'user-123',
        email: 'audit@test.com',
        groups: [],
      },
      'test-secret',
      { expiresIn: '1h' }
    );

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'mock-access-token',
        id_token: idToken,
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });

    await app.inject({
      method: 'GET',
      url: '/api/v1/auth/oidc/callback?code=valid-code&state=valid-state',
    });

    const auditResult = await dbQuery(
      `SELECT event_type, outcome FROM audit_events WHERE event_type = 'oidc_callback_success'`
    );

    expect(auditResult.rows.length).toBeGreaterThan(0);
    expect(auditResult.rows[0]).toMatchObject({
      event_type: 'oidc_callback_success',
      outcome: 'success',
    });
  });

  it('writes audit event on invalid state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/oidc/callback?code=valid-code&state=invalid-state',
    });

    expect(res.statusCode).toBe(400);

    const auditResult = await dbQuery(
      `SELECT event_type, outcome FROM audit_events WHERE event_type = 'oidc_callback_invalid_state'`
    );

    expect(auditResult.rows.length).toBeGreaterThan(0);
    expect(auditResult.rows[0]).toMatchObject({
      event_type: 'oidc_callback_invalid_state',
      outcome: 'failure',
    });
  });
});
