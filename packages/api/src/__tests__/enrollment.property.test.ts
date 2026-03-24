/**
 * Property-based tests for the target enrollment endpoints.
 *
 * Properties tested:
 *   Property 7: Enrollment token single-use invariant
 *   Property 8: Node identity key pair validity
 *
 * Feature: cig-auth-provisioning
 *
 * **Validates: Requirements 4.2, 13.2, 13.5 (Property 7)**
 * **Validates: Requirements 4.4, 13.4 (Property 8)**
 */

// Feature: cig-auth-provisioning, Property 7: For any enrollment token, using it once via
// POST /api/v1/targets/enroll should succeed; any subsequent use of the same token should
// return HTTP 410 with error code token_consumed.
// Validates: Requirements 4.2, 13.2, 13.5

// Feature: cig-auth-provisioning, Property 8: For any successful enrollment, the returned
// private_key and public_key should form a valid Ed25519 key pair — i.e., a message signed
// with the private key should verify against the public key.
// Validates: Requirements 4.4, 13.4

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import crypto from 'crypto';
import { createServer } from '../index';
import type { FastifyInstance } from 'fastify';
import { generateJwt, Permission } from '../auth';

// ─── Global configuration ─────────────────────────────────────────────────────

fc.configureGlobal({ numRuns: 1000 });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAuthHeader(userId = 'test-user-id'): string {
  const token = generateJwt({ sub: userId, permissions: [Permission.ADMIN] });
  return `Bearer ${token}`;
}

/** Insert an enrollment token directly into the DB for testing. */
async function insertToken(
  dbQuery: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>,
  token: string,
  userId: string,
  expiresAt: Date,
  used = false
): Promise<void> {
  await dbQuery(
    `INSERT INTO enrollment_tokens (token, user_id, expires_at, used)
     VALUES (?, ?, ?, ?)`,
    [token, userId, expiresAt.toISOString(), used ? 1 : 0]
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let app: FastifyInstance;
let dbQuery: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;

beforeAll(async () => {
  process.env['DATABASE_URL'] = 'sqlite://:memory:';
  process.env['JWT_SECRET'] = 'test-secret-for-property-tests-at-least-32-chars!!';

  app = await createServer();

  const clientModule = await import('../db/client');
  dbQuery = clientModule.query;

  // Create required tables
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS enrollment_tokens (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS managed_targets (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL,
      hostname       TEXT NOT NULL,
      os             TEXT NOT NULL,
      architecture   TEXT NOT NULL,
      ip_address     TEXT NOT NULL,
      profile        TEXT NOT NULL DEFAULT 'core',
      public_key     TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'online',
      last_seen      TEXT,
      service_status TEXT,
      system_metrics TEXT,
      cig_version    TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS audit_events (
      id          TEXT PRIMARY KEY,
      event_type  TEXT NOT NULL,
      actor       TEXT NOT NULL,
      ip_address  TEXT NOT NULL,
      outcome     TEXT NOT NULL,
      metadata    TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await dbQuery('DELETE FROM enrollment_tokens');
  await dbQuery('DELETE FROM managed_targets');
  await dbQuery('DELETE FROM audit_events');
});

// ─── Property 7: Enrollment token single-use invariant ────────────────────────

describe('Property 7: Enrollment token single-use invariant', () => {
  it('first use of a valid token succeeds; second use returns HTTP 410 with token_consumed', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate varied hostnames, OS, architecture values
        fc.record({
          hostname: fc.stringMatching(/^[a-z][a-z0-9-]{2,15}$/),
          os: fc.constantFrom('linux', 'darwin', 'windows'),
          architecture: fc.constantFrom('amd64', 'arm64', 'x86_64'),
          ip_address: fc.ipV4(),
          // Unique API key per run to avoid rate limiter (100 req/min per client)
          runId: fc.uuid(),
        }),
        async ({ hostname, os, architecture, ip_address, runId }) => {
          const uniqueApiKey = `test-key-${runId}`;

          // Issue a fresh enrollment token via the API
          const tokenRes = await app.inject({
            method: 'POST',
            url: '/api/v1/targets/enrollment-token',
            headers: {
              authorization: makeAuthHeader(),
              'x-api-key': uniqueApiKey,
            },
          });
          expect(tokenRes.statusCode).toBe(201);
          const { enrollment_token } = tokenRes.json<{ enrollment_token: string }>();

          const enrollPayload = { enrollment_token, hostname, os, architecture, ip_address };

          // First use — must succeed
          const firstRes = await app.inject({
            method: 'POST',
            url: '/api/v1/targets/enroll',
            headers: { 'x-api-key': uniqueApiKey },
            payload: enrollPayload,
          });
          expect(firstRes.statusCode).toBe(201);

          // Second use — must return 410 with token_consumed
          const secondRes = await app.inject({
            method: 'POST',
            url: '/api/v1/targets/enroll',
            headers: { 'x-api-key': uniqueApiKey },
            payload: enrollPayload,
          });
          expect(secondRes.statusCode).toBe(410);
          const secondBody = secondRes.json<{ code: string }>();
          expect(secondBody.code).toBe('token_consumed');
        }
      ),
      { numRuns: 20 } // Reduced from 1000 — each run makes real DB calls
    );
  });

  it('an already-used token returns HTTP 410 immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hostname: fc.stringMatching(/^[a-z][a-z0-9-]{2,15}$/),
          os: fc.constantFrom('linux', 'darwin'),
          architecture: fc.constantFrom('amd64', 'arm64'),
          ip_address: fc.ipV4(),
        }),
        async ({ hostname, os, architecture, ip_address }) => {
          // Insert a pre-used token directly
          const token = crypto.randomUUID();
          const futureExpiry = new Date(Date.now() + 600_000);
          await insertToken(dbQuery, token, 'test-user-id', futureExpiry, true);

          const res = await app.inject({
            method: 'POST',
            url: '/api/v1/targets/enroll',
            payload: { enrollment_token: token, hostname, os, architecture, ip_address },
          });

          expect(res.statusCode).toBe(410);
          expect(res.json<{ code: string }>().code).toBe('token_consumed');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('an expired token returns HTTP 410 with token_consumed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hostname: fc.stringMatching(/^[a-z][a-z0-9-]{2,15}$/),
          os: fc.constantFrom('linux', 'darwin'),
          architecture: fc.constantFrom('amd64', 'arm64'),
          ip_address: fc.ipV4(),
        }),
        async ({ hostname, os, architecture, ip_address }) => {
          // Insert an expired token
          const token = crypto.randomUUID();
          const pastExpiry = new Date(Date.now() - 1000);
          await insertToken(dbQuery, token, 'test-user-id', pastExpiry, false);

          const res = await app.inject({
            method: 'POST',
            url: '/api/v1/targets/enroll',
            payload: { enrollment_token: token, hostname, os, architecture, ip_address },
          });

          expect(res.statusCode).toBe(410);
          expect(res.json<{ code: string }>().code).toBe('token_consumed');
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ─── Property 8: Node identity key pair validity ──────────────────────────────

describe('Property 8: Node identity key pair validity', () => {
  it('returned private_key and public_key form a valid Ed25519 key pair', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hostname: fc.stringMatching(/^[a-z][a-z0-9-]{2,15}$/),
          os: fc.constantFrom('linux', 'darwin', 'windows'),
          architecture: fc.constantFrom('amd64', 'arm64', 'x86_64'),
          ip_address: fc.ipV4(),
          message: fc.uint8Array({ minLength: 1, maxLength: 256 }),
          // Unique API key per run to avoid rate limiter (100 req/min per client)
          runId: fc.uuid(),
        }),
        async ({ hostname, os, architecture, ip_address, message, runId }) => {
          const uniqueApiKey = `test-key-${runId}`;

          // Issue a fresh enrollment token — use unique API key to bypass rate limiter
          const tokenRes = await app.inject({
            method: 'POST',
            url: '/api/v1/targets/enrollment-token',
            headers: {
              authorization: makeAuthHeader(),
              'x-api-key': uniqueApiKey,
            },
          });
          expect(tokenRes.statusCode).toBe(201);
          const { enrollment_token } = tokenRes.json<{ enrollment_token: string }>();

          // Enroll — use same unique API key
          const enrollRes = await app.inject({
            method: 'POST',
            url: '/api/v1/targets/enroll',
            headers: { 'x-api-key': uniqueApiKey },
            payload: { enrollment_token, hostname, os, architecture, ip_address },
          });
          expect(enrollRes.statusCode).toBe(201);

          const { private_key, public_key } = enrollRes.json<{
            target_id: string;
            private_key: string;
            public_key: string;
          }>();

          // Verify the key pair: sign with private key, verify with public key
          const msgBuffer = Buffer.from(message);
          const signature = crypto.sign(null, msgBuffer, private_key);
          const isValid = crypto.verify(null, msgBuffer, public_key, signature);

          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 20 } // Reduced — each run makes real DB calls + crypto ops
    );
  });

  it('private_key from one enrollment does not verify against public_key from another', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          message: fc.uint8Array({ minLength: 1, maxLength: 256 }),
          runId: fc.uuid(),
        }),
        async ({ message, runId }) => {
          // Enroll twice to get two distinct key pairs
          // Use unique API keys per run to avoid rate limiter
          const enroll = async (suffix: string) => {
            const uniqueApiKey = `test-key-${runId}-${suffix}`;
            const tokenRes = await app.inject({
              method: 'POST',
              url: '/api/v1/targets/enrollment-token',
              headers: {
                authorization: makeAuthHeader(),
                'x-api-key': uniqueApiKey,
              },
            });
            expect(tokenRes.statusCode).toBe(201);
            const { enrollment_token } = tokenRes.json<{ enrollment_token: string }>();

            const enrollRes = await app.inject({
              method: 'POST',
              url: '/api/v1/targets/enroll',
              headers: { 'x-api-key': uniqueApiKey },
              payload: {
                enrollment_token,
                hostname: 'test-host',
                os: 'linux',
                architecture: 'amd64',
                ip_address: '10.0.0.1',
              },
            });
            expect(enrollRes.statusCode).toBe(201);
            return enrollRes.json<{ private_key: string; public_key: string }>();
          };

          const pair1 = await enroll('a');
          const pair2 = await enroll('b');

          // Sign with pair1's private key, verify against pair2's public key — must fail
          const msgBuffer = Buffer.from(message);
          const signature = crypto.sign(null, msgBuffer, pair1.private_key);

          let crossVerifyFailed = false;
          try {
            const result = crypto.verify(null, msgBuffer, pair2.public_key, signature);
            crossVerifyFailed = !result;
          } catch {
            crossVerifyFailed = true;
          }

          expect(crossVerifyFailed).toBe(true);
        }
      ),
      { numRuns: 10 } // Reduced — each run makes 2 enrollments
    );
  });
});
