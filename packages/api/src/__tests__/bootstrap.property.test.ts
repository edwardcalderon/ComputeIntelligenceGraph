/**
 * Property-based tests for the bootstrap endpoints.
 *
 * Properties tested:
 *   Property 10: Bootstrap token single-use invariant
 *   Property 11: Password length validation
 *
 * Feature: cig-auth-provisioning
 *
 * **Validates: Requirements 5.10, 5.11, 15.4, 15.5 (Property 10)**
 * **Validates: Requirements 5.8, 15.7 (Property 11)**
 */

// Feature: cig-auth-provisioning, Property 10: For any bootstrap token, calling
// POST /api/v1/bootstrap/complete with it once should succeed and return a session token;
// any subsequent call with the same token should return HTTP 409 with error code
// bootstrap_already_complete.
// Validates: Requirements 5.10, 5.11, 15.4, 15.5

// Feature: cig-auth-provisioning, Property 11: For any password string with fewer than
// 12 characters, POST /api/v1/bootstrap/complete should return HTTP 422 with error code
// password_too_short.
// Validates: Requirements 5.8, 15.7

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import crypto from 'crypto';
import { createServer } from '../index';
import type { FastifyInstance } from 'fastify';

// ─── Global configuration ─────────────────────────────────────────────────────

fc.configureGlobal({ numRuns: 100 });

// ─── Setup ────────────────────────────────────────────────────────────────────

let app: FastifyInstance;
let dbQuery: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;

beforeAll(async () => {
  process.env['DATABASE_URL'] = 'sqlite://:memory:';
  process.env['JWT_SECRET'] = 'test-secret-for-bootstrap-property-tests-32chars!!';
  process.env['CIG_AUTH_MODE'] = 'self-hosted';

  app = await createServer();

  const clientModule = await import('../db/client');
  dbQuery = clientModule.query;

  // Create required tables
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
  await resetBootstrapState();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Insert a fresh, unconsumed bootstrap token with a future expiry. */
async function insertToken(token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
  await dbQuery(
    `INSERT INTO bootstrap_tokens (token, expires_at, consumed) VALUES (?, ?, 0)`,
    [token, expiresAt]
  );
}

async function resetBootstrapState(): Promise<void> {
  await dbQuery('DELETE FROM bootstrap_tokens');
  await dbQuery('DELETE FROM admin_accounts');
  await dbQuery('DELETE FROM audit_events');
}

/** Build a valid complete payload using the given token and unique identifiers. */
function completePayload(
  token: string,
  suffix: string
): Record<string, string> {
  return {
    bootstrap_token: token,
    username: `admin_${suffix}`,
    email: `admin_${suffix}@example.com`,
    password: 'SecurePass123!',
  };
}

// ─── Property 10: Bootstrap token single-use invariant ────────────────────────

describe('Property 10: Bootstrap token single-use invariant', () => {
  it('first call succeeds; second call returns HTTP 409 with bootstrap_already_complete', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a unique run ID to avoid username/email collisions across runs
        fc.uuid(),
        async (runId) => {
          await resetBootstrapState();

          try {
            const token = crypto.randomBytes(16).toString('hex'); // 32-char hex
            await insertToken(token);

            const suffix = runId.replace(/-/g, '').slice(0, 12);
            const payload = completePayload(token, suffix);

            // First call — must succeed with 201 and return tokens
            const firstRes = await app.inject({
              method: 'POST',
              url: '/api/v1/bootstrap/complete',
              payload,
            });
            expect(firstRes.statusCode).toBe(201);
            const firstBody = firstRes.json<{
              access_token: string;
              refresh_token: string;
            }>();
            expect(firstBody.access_token).toBeTruthy();
            expect(firstBody.refresh_token).toBeTruthy();

            // Second call with the same token — must return 409 bootstrap_already_complete
            const secondRes = await app.inject({
              method: 'POST',
              url: '/api/v1/bootstrap/complete',
              payload,
            });
            expect(secondRes.statusCode).toBe(409);
            const secondBody = secondRes.json<{ code: string }>();
            expect(secondBody.code).toBe('bootstrap_already_complete');
          } finally {
            await resetBootstrapState();
          }
        }
      ),
      { numRuns: 20 } // Reduced — each run makes real DB calls
    );
  }, 60_000); // bcrypt hashing takes ~400ms per run × 20 runs

  it('a pre-consumed token returns HTTP 409 immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (runId) => {
          await resetBootstrapState();

          try {
            const token = crypto.randomBytes(16).toString('hex');
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

            // Insert already-consumed token
            await dbQuery(
              `INSERT INTO bootstrap_tokens (token, expires_at, consumed) VALUES (?, ?, 1)`,
              [token, expiresAt]
            );

            const suffix = runId.replace(/-/g, '').slice(0, 12);
            const res = await app.inject({
              method: 'POST',
              url: '/api/v1/bootstrap/complete',
              payload: completePayload(token, suffix),
            });

            expect(res.statusCode).toBe(409);
            expect(res.json<{ code: string }>().code).toBe('bootstrap_already_complete');
          } finally {
            await resetBootstrapState();
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30_000);
});

// ─── Property 11: Password length validation ──────────────────────────────────

describe('Property 11: Password length validation', () => {
  it('any password shorter than 12 chars returns HTTP 422 with password_too_short', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate passwords of length 0–11
        fc.integer({ min: 0, max: 11 }).chain((len) =>
          fc.string({ minLength: len, maxLength: len })
        ),
        fc.uuid(),
        async (shortPassword, runId) => {
          await resetBootstrapState();

          try {
            const token = crypto.randomBytes(16).toString('hex');
            await insertToken(token);

            const suffix = runId.replace(/-/g, '').slice(0, 12);

            const res = await app.inject({
              method: 'POST',
              url: '/api/v1/bootstrap/complete',
              // Use unique API key per run to avoid rate limiter (100 req/min per client)
              headers: { 'x-api-key': `test-key-${runId}` },
              payload: {
                bootstrap_token: token,
                username: `admin_${suffix}`,
                email: `admin_${suffix}@example.com`,
                password: shortPassword,
              },
            });

            expect(res.statusCode).toBe(422);
            expect(res.json<{ code: string }>().code).toBe('password_too_short');
          } finally {
            await resetBootstrapState();
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30_000);

  it('a password of exactly 12 chars is accepted (not rejected)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate passwords of exactly 12 characters
        fc.string({ minLength: 12, maxLength: 12 }),
        fc.uuid(),
        async (exactPassword, runId) => {
          await resetBootstrapState();

          try {
            const token = crypto.randomBytes(16).toString('hex');
            await insertToken(token);

            const suffix = runId.replace(/-/g, '').slice(0, 12);

            const res = await app.inject({
              method: 'POST',
              url: '/api/v1/bootstrap/complete',
              // Use unique API key per run to avoid rate limiter
              headers: { 'x-api-key': `test-key-${runId}` },
              payload: {
                bootstrap_token: token,
                username: `admin_${suffix}`,
                email: `admin_${suffix}@example.com`,
                password: exactPassword,
              },
            });

            // Must NOT return 422 password_too_short
            expect(res.statusCode).not.toBe(422);
            if (res.statusCode === 422) {
              const body = res.json<{ code: string }>();
              expect(body.code).not.toBe('password_too_short');
            }
          } finally {
            await resetBootstrapState();
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30_000);
});
