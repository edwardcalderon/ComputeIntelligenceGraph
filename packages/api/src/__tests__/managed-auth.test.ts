import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('../middleware/oidc-verify', () => ({
  verifyIdToken: vi.fn(),
}));

import { createServer } from '../index';
import { query } from '../db/client';
import { verifyIdToken } from '../middleware/oidc-verify';

const mockVerifyIdToken = vi.mocked(verifyIdToken);

describe('managed-mode auth', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env['DATABASE_URL'] = 'sqlite://:memory:';
    process.env['CIG_AUTH_MODE'] = 'managed';
    process.env['AUTHENTIK_ISSUER_URL'] = 'https://auth.example.com/application/o/cig/';
    process.env['AUTHENTIK_JWKS_URI'] = 'https://auth.example.com/application/o/cig/jwks/';
    process.env['OIDC_CLIENT_ID'] = 'test-client-id';

    app = await createServer();

    await query(`
      CREATE TABLE IF NOT EXISTS device_auth_records (
        device_code    TEXT PRIMARY KEY,
        user_code      TEXT NOT NULL UNIQUE,
        user_id        TEXT,
        status         TEXT NOT NULL DEFAULT 'pending',
        ip_address     TEXT NOT NULL,
        expires_at     TEXT NOT NULL,
        access_token   TEXT,
        refresh_token  TEXT,
        session_id     TEXT,
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
    mockVerifyIdToken.mockReset();
    await query('DELETE FROM device_auth_records');
  });

  it('accepts upstream Authentik tokens on authenticated dashboard routes', async () => {
    mockVerifyIdToken.mockResolvedValue({
      sub: 'authentik-user-1',
      email: 'person@example.com',
      groups: ['users'],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/device/pending',
      headers: {
        authorization: 'Bearer upstream-authentik-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], total: 0 });
    expect(mockVerifyIdToken).toHaveBeenCalledTimes(1);
  });

  it('falls back to upstream Authentik verification when managed mode is implied by OIDC config', async () => {
    delete process.env['CIG_AUTH_MODE'];

    mockVerifyIdToken.mockResolvedValue({
      sub: 'authentik-user-2',
      email: 'person2@example.com',
      groups: ['users'],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/device/pending',
      headers: {
        authorization: 'Bearer upstream-authentik-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], total: 0 });
    expect(mockVerifyIdToken).toHaveBeenCalledTimes(1);
  });
});
