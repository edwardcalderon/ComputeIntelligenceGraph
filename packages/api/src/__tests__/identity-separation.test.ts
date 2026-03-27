/**
 * Unit tests for identity separation middleware.
 *
 * Tests requireHumanAuth, requireNodeAuth, and requireBootstrapToken.
 * Verifies that each middleware rejects the other identity types with 401
 * and logs identity plane crossings as AuditEvent records.
 *
 * Requirements: 14.1–14.10
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createServer } from '../index';
import { requireHumanAuth, requireNodeAuth, requireBootstrapToken } from '../middleware/auth';
import { generateJwt } from '../auth';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let app: FastifyInstance;
let dbQuery: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;

beforeAll(async () => {
  process.env['DATABASE_URL'] = 'sqlite://:memory:';
  process.env['JWT_SECRET'] = 'test-secret-for-identity-separation-tests-at-least-32!!';
  process.env['CIG_AUTH_MODE'] = 'self-hosted';

  app = await createServer();

  const clientModule = await import('../db/client');
  dbQuery = clientModule.query;

  // Create tables needed by the middleware
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS onboarding_audit_events (
      id            TEXT PRIMARY KEY,
      actor_type    TEXT NOT NULL,
      actor_id      TEXT NOT NULL,
      action        TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id   TEXT NOT NULL,
      metadata      TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS node_identity_records (
      id          TEXT PRIMARY KEY,
      node_id     TEXT NOT NULL,
      public_key  TEXT NOT NULL,
      revoked_at  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS bootstrap_token_records (
      id                 TEXT PRIMARY KEY,
      token_hash         TEXT NOT NULL,
      first_accessed_at  TEXT,
      used_at            TEXT,
      expires_at         TEXT NOT NULL,
      created_at         TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Register test routes that use the middleware
  app.post('/test/human', { preHandler: [requireHumanAuth] }, async (_req, reply) => {
    return reply.send({ ok: true });
  });

  app.post('/test/node', { preHandler: [requireNodeAuth] }, async (req, reply) => {
    return reply.send({ ok: true, nodeId: req.nodeId });
  });

  app.post('/test/bootstrap', { preHandler: [requireBootstrapToken] }, async (req, reply) => {
    return reply.send({ ok: true, tokenId: req.bootstrapToken?.id });
  });

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await dbQuery('DELETE FROM onboarding_audit_events');
  await dbQuery('DELETE FROM node_identity_records');
  await dbQuery('DELETE FROM bootstrap_token_records');
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateJwtToken(): string {
  return generateJwt({ sub: 'user-123', permissions: [] });
}

function generateNodeKeyPair(): { privateKey: crypto.KeyObject; publicKeyB64: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  return {
    privateKey: crypto.createPrivateKey({ key: privateKey as unknown as Buffer, format: 'der', type: 'pkcs8' }),
    publicKeyB64: (publicKey as unknown as Buffer).toString('base64'),
  };
}

function signBody(body: string, privateKey: crypto.KeyObject): string {
  return crypto.sign(null, Buffer.from(body), privateKey).toString('base64');
}

async function insertNodeIdentity(nodeId: string, publicKeyB64: string, revoked = false): Promise<void> {
  await dbQuery(
    `INSERT INTO node_identity_records (id, node_id, public_key, revoked_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      nodeId,
      publicKeyB64,
      revoked ? new Date().toISOString() : null,
      new Date().toISOString(),
    ]
  );
}

async function insertBootstrapToken(
  rawToken: string,
  opts: { used?: boolean; expired?: boolean } = {}
): Promise<string> {
  const id = crypto.randomUUID();
  const tokenHash = await bcrypt.hash(rawToken, 4); // low rounds for test speed
  const expiresAt = opts.expired
    ? new Date(Date.now() - 1000).toISOString()
    : new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const usedAt = opts.used ? new Date().toISOString() : null;

  await dbQuery(
    `INSERT INTO bootstrap_token_records (id, token_hash, used_at, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, tokenHash, usedAt, expiresAt, new Date().toISOString()]
  );
  return id;
}

// ---------------------------------------------------------------------------
// requireHumanAuth
// ---------------------------------------------------------------------------

describe('requireHumanAuth', () => {
  it('accepts a valid Bearer JWT', async () => {
    const token = generateJwtToken();
    const res = await app.inject({
      method: 'POST',
      url: '/test/human',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects with 401 when no auth header is present', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/human',
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('missing_auth');
  });

  it('rejects with 401 when X-Node-Signature header is present (identity plane crossing)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/human',
      headers: { 'x-node-signature': 'node-123:abc123' },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('identity_plane_crossing');
  });

  it('logs an audit event when X-Node-Signature is present on human endpoint', async () => {
    await app.inject({
      method: 'POST',
      url: '/test/human',
      headers: { 'x-node-signature': 'node-abc:sig123' },
      payload: {},
    });

    // Give fire-and-forget a tick to complete
    await new Promise((r) => setTimeout(r, 50));

    const result = await dbQuery(
      `SELECT * FROM onboarding_audit_events WHERE action = 'identity_plane_crossing'`
    );
    expect(result.rows.length).toBeGreaterThan(0);
    const event = result.rows[0] as Record<string, unknown>;
    expect(event['actor_type']).toBe('node');
    expect(event['action']).toBe('identity_plane_crossing');
  });

  it('rejects with 401 when bootstrap_token is in body (identity plane crossing)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/human',
      payload: { bootstrap_token: 'some-token' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('identity_plane_crossing');
  });

  it('rejects with 401 for an invalid JWT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/human',
      headers: { authorization: 'Bearer invalid.jwt.token' },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('invalid_token');
  });
});

// ---------------------------------------------------------------------------
// requireNodeAuth
// ---------------------------------------------------------------------------

describe('requireNodeAuth', () => {
  it('accepts a valid Ed25519 signature', async () => {
    const nodeId = crypto.randomUUID();
    const { privateKey, publicKeyB64 } = generateNodeKeyPair();
    await insertNodeIdentity(nodeId, publicKeyB64);

    const body = JSON.stringify({ test: 'payload' });
    const sig = signBody(body, privateKey);

    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      headers: {
        'x-node-signature': `${nodeId}:${sig}`,
        'content-type': 'application/json',
      },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ nodeId: string }>().nodeId).toBe(nodeId);
  });

  it('rejects with 401 when Authorization Bearer header is present (identity plane crossing)', async () => {
    const token = generateJwtToken();
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('identity_plane_crossing');
  });

  it('logs an audit event when Bearer token is present on node endpoint', async () => {
    const token = generateJwtToken();
    await app.inject({
      method: 'POST',
      url: '/test/node',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    await new Promise((r) => setTimeout(r, 50));

    const result = await dbQuery(
      `SELECT * FROM onboarding_audit_events WHERE action = 'identity_plane_crossing'`
    );
    expect(result.rows.length).toBeGreaterThan(0);
    const event = result.rows[0] as Record<string, unknown>;
    expect(event['actor_type']).toBe('human');
  });

  it('rejects with 401 when X-Node-Signature header is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('missing_node_signature');
  });

  it('rejects with 401 when X-Node-Signature header is malformed (no colon)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      headers: { 'x-node-signature': 'invalidsignaturenocodon' },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('malformed_node_signature');
  });

  it('rejects with 401 when node is not found', async () => {
    const nodeId = crypto.randomUUID();
    const { privateKey } = generateNodeKeyPair();
    const body = JSON.stringify({});
    const sig = signBody(body, privateKey);

    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      headers: {
        'x-node-signature': `${nodeId}:${sig}`,
        'content-type': 'application/json',
      },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('node_not_found');
  });

  it('rejects with 401 when node is revoked', async () => {
    const nodeId = crypto.randomUUID();
    const { privateKey, publicKeyB64 } = generateNodeKeyPair();
    await insertNodeIdentity(nodeId, publicKeyB64, true); // revoked

    const body = JSON.stringify({});
    const sig = signBody(body, privateKey);

    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      headers: {
        'x-node-signature': `${nodeId}:${sig}`,
        'content-type': 'application/json',
      },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('node_not_found');
  });

  it('rejects with 401 when signature is invalid', async () => {
    const nodeId = crypto.randomUUID();
    const { publicKeyB64 } = generateNodeKeyPair();
    await insertNodeIdentity(nodeId, publicKeyB64);

    const res = await app.inject({
      method: 'POST',
      url: '/test/node',
      headers: {
        'x-node-signature': `${nodeId}:invalidsignature`,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({}),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('invalid_node_signature');
  });
});

// ---------------------------------------------------------------------------
// requireBootstrapToken
// ---------------------------------------------------------------------------

describe('requireBootstrapToken', () => {
  it('accepts a valid bootstrap token', async () => {
    const rawToken = crypto.randomBytes(16).toString('hex');
    const id = await insertBootstrapToken(rawToken);

    const res = await app.inject({
      method: 'POST',
      url: '/test/bootstrap',
      payload: { bootstrap_token: rawToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ tokenId: string }>().tokenId).toBe(id);
  });

  it('rejects with 401 when Authorization Bearer header is present (identity plane crossing)', async () => {
    const token = generateJwtToken();
    const res = await app.inject({
      method: 'POST',
      url: '/test/bootstrap',
      headers: { authorization: `Bearer ${token}` },
      payload: { bootstrap_token: 'some-token' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('identity_plane_crossing');
  });

  it('rejects with 401 when X-Node-Signature header is present (identity plane crossing)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/bootstrap',
      headers: { 'x-node-signature': 'node-123:sig' },
      payload: { bootstrap_token: 'some-token' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('identity_plane_crossing');
  });

  it('logs an audit event when Bearer token is present on bootstrap endpoint', async () => {
    const token = generateJwtToken();
    await app.inject({
      method: 'POST',
      url: '/test/bootstrap',
      headers: { authorization: `Bearer ${token}` },
      payload: { bootstrap_token: 'some-token' },
    });

    await new Promise((r) => setTimeout(r, 50));

    const result = await dbQuery(
      `SELECT * FROM onboarding_audit_events WHERE action = 'identity_plane_crossing'`
    );
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('logs an audit event when X-Node-Signature is present on bootstrap endpoint', async () => {
    await app.inject({
      method: 'POST',
      url: '/test/bootstrap',
      headers: { 'x-node-signature': 'node-xyz:sig' },
      payload: { bootstrap_token: 'some-token' },
    });

    await new Promise((r) => setTimeout(r, 50));

    const result = await dbQuery(
      `SELECT * FROM onboarding_audit_events WHERE action = 'identity_plane_crossing'`
    );
    expect(result.rows.length).toBeGreaterThan(0);
    const event = result.rows[0] as Record<string, unknown>;
    expect(event['actor_type']).toBe('node');
  });

  it('rejects with 401 when bootstrap_token is missing from body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/bootstrap',
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('missing_bootstrap_token');
  });

  it('rejects with 401 for an expired token', async () => {
    const rawToken = crypto.randomBytes(16).toString('hex');
    await insertBootstrapToken(rawToken, { expired: true });

    const res = await app.inject({
      method: 'POST',
      url: '/test/bootstrap',
      payload: { bootstrap_token: rawToken },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('invalid_bootstrap_token');
  });

  it('rejects with 401 for an already-used token', async () => {
    const rawToken = crypto.randomBytes(16).toString('hex');
    await insertBootstrapToken(rawToken, { used: true });

    const res = await app.inject({
      method: 'POST',
      url: '/test/bootstrap',
      payload: { bootstrap_token: rawToken },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('invalid_bootstrap_token');
  });

  it('rejects with 401 for an unknown token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/bootstrap',
      payload: { bootstrap_token: 'completely-unknown-token' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ code: string }>().code).toBe('invalid_bootstrap_token');
  });
});
