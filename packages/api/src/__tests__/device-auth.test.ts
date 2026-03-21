/**
 * Unit tests for the device authorization lifecycle.
 *
 * Covers:
 *   - Full approve flow: authorize → approve → poll returns tokens
 *   - Full deny flow: authorize → deny → poll returns denied
 *   - Expiry: expired device_code returns { status: "expired" }
 *   - Rate limiting: second rapid poll returns { status: "slow_down" }
 *   - Logout: invalidates session token
 *
 * Requirement 12: API — Device Authorization Endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../index';
import { generateJwt, Permission } from '../auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAuthHeader(): string {
  const token = generateJwt({ sub: 'test-user-id', permissions: [Permission.ADMIN] });
  return `Bearer ${token}`;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let app: FastifyInstance;
let dbQuery: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;

beforeAll(async () => {
  process.env['DATABASE_URL'] = 'sqlite://:memory:';
  process.env['JWT_SECRET'] = 'test-secret-for-unit-tests-at-least-32-chars!!';
  process.env['VERIFICATION_URI'] = 'https://cig.lat/device';

  app = await createServer();

  const clientModule = await import('../db/client');
  dbQuery = clientModule.query;

  // Create the device_auth_records table
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS device_auth_records (
      device_code    TEXT PRIMARY KEY,
      user_code      TEXT NOT NULL UNIQUE,
      user_id        TEXT,
      status         TEXT NOT NULL DEFAULT 'pending',
      ip_address     TEXT NOT NULL,
      expires_at     TEXT NOT NULL,
      access_token   TEXT,
      refresh_token  TEXT,
      last_polled_at TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  // Clear records between tests
  await dbQuery('DELETE FROM device_auth_records');
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/device/authorize', () => {
  it('returns 201 with device_code, user_code, verification_uri, expires_in', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/authorize',
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{
      device_code: string;
      user_code: string;
      verification_uri: string;
      expires_in: number;
    }>();

    expect(body.device_code).toMatch(/^[0-9a-f]{32}$/);
    expect(body.user_code).toMatch(/^[A-Z0-9]{8}$/);
    expect(body.verification_uri).toBeTruthy();
    expect(body.expires_in).toBe(900);
  });

  it('generates unique device_codes on each call', async () => {
    const res1 = await app.inject({ method: 'POST', url: '/api/v1/auth/device/authorize' });
    const res2 = await app.inject({ method: 'POST', url: '/api/v1/auth/device/authorize' });

    const b1 = res1.json<{ device_code: string }>();
    const b2 = res2.json<{ device_code: string }>();

    expect(b1.device_code).not.toBe(b2.device_code);
  });
});

describe('Full approve lifecycle', () => {
  it('authorize → approve → poll returns approved with tokens', async () => {
    // Step 1: authorize
    const authRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/authorize',
    });
    expect(authRes.statusCode).toBe(201);
    const { device_code, user_code } = authRes.json<{
      device_code: string;
      user_code: string;
    }>();

    // Step 2: approve (requires authenticated session)
    const approveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/approve',
      headers: { authorization: makeAuthHeader() },
      payload: { user_code },
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json()).toMatchObject({ success: true });

    // Step 3: poll — should return approved with tokens
    const pollRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/poll',
      payload: { device_code },
    });
    expect(pollRes.statusCode).toBe(200);
    const pollBody = pollRes.json<{
      status: string;
      access_token: string;
      refresh_token: string;
      token_type: string;
    }>();

    expect(pollBody.status).toBe('approved');
    expect(pollBody.access_token).toBeTruthy();
    expect(pollBody.refresh_token).toBeTruthy();
    expect(pollBody.token_type).toBe('Bearer');
  });
});

describe('Full deny lifecycle', () => {
  it('authorize → deny → poll returns denied', async () => {
    // Step 1: authorize
    const authRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/authorize',
    });
    const { device_code, user_code } = authRes.json<{
      device_code: string;
      user_code: string;
    }>();

    // Step 2: deny
    const denyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/deny',
      headers: { authorization: makeAuthHeader() },
      payload: { user_code },
    });
    expect(denyRes.statusCode).toBe(200);
    expect(denyRes.json()).toMatchObject({ success: true });

    // Step 3: poll — should return denied
    const pollRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/poll',
      payload: { device_code },
    });
    expect(pollRes.statusCode).toBe(200);
    expect(pollRes.json()).toMatchObject({ status: 'denied' });
  });
});

describe('Expiry', () => {
  it('poll returns expired for an already-expired device_code', async () => {
    // Insert an already-expired record directly
    const expiredCode = 'a'.repeat(32);
    const expiredUserCode = 'EXPRD001';
    const pastTime = new Date(Date.now() - 1000).toISOString();

    await dbQuery(
      `INSERT INTO device_auth_records (device_code, user_code, ip_address, expires_at)
       VALUES (?, ?, ?, ?)`,
      [expiredCode, expiredUserCode, '127.0.0.1', pastTime]
    );

    const pollRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/poll',
      payload: { device_code: expiredCode },
    });

    expect(pollRes.statusCode).toBe(200);
    expect(pollRes.json()).toMatchObject({ status: 'expired' });
  });

  it('poll returns expired for an unknown device_code', async () => {
    const pollRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/poll',
      payload: { device_code: 'f'.repeat(32) },
    });

    expect(pollRes.statusCode).toBe(200);
    expect(pollRes.json()).toMatchObject({ status: 'expired' });
  });
});

describe('Rate limiting', () => {
  it('second rapid poll within 5s returns slow_down', async () => {
    // Step 1: authorize
    const authRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/authorize',
    });
    const { device_code } = authRes.json<{ device_code: string }>();

    // Step 2: first poll — sets last_polled_at
    const poll1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/poll',
      payload: { device_code },
    });
    expect(poll1.statusCode).toBe(200);
    expect(poll1.json<{ status: string }>().status).toBe('pending');

    // Step 3: immediate second poll — should be rate-limited
    const poll2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/poll',
      payload: { device_code },
    });
    expect(poll2.statusCode).toBe(200);
    expect(poll2.json()).toMatchObject({ status: 'slow_down' });
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('returns success even without a token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true });
  });

  it('invalidates the access_token associated with the session', async () => {
    // Authorize and approve to get a real access_token
    const authRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/authorize',
    });
    const { device_code, user_code } = authRes.json<{
      device_code: string;
      user_code: string;
    }>();

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/approve',
      headers: { authorization: makeAuthHeader() },
      payload: { user_code },
    });

    const pollRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/poll',
      payload: { device_code },
    });
    const { access_token } = pollRes.json<{ access_token: string }>();

    // Logout with the access_token
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${access_token}` },
    });
    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json()).toMatchObject({ success: true });

    // Verify the record is now expired in the DB
    const result = await dbQuery(
      `SELECT status FROM device_auth_records WHERE device_code = ?`,
      [device_code]
    );
    const row = result.rows[0] as { status: string } | undefined;
    expect(row?.status).toBe('expired');
  });
});

describe('Approve/Deny validation', () => {
  it('approve returns 401 without authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/approve',
      payload: { user_code: 'TESTCODE' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('deny returns 401 without authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/deny',
      payload: { user_code: 'TESTCODE' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('approve returns 404 for unknown user_code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/approve',
      headers: { authorization: makeAuthHeader() },
      payload: { user_code: 'NOTFOUND' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('deny returns 404 for unknown user_code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/deny',
      headers: { authorization: makeAuthHeader() },
      payload: { user_code: 'NOTFOUND' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('poll returns 400 when device_code is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/device/poll',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
