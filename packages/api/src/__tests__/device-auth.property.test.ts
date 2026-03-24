/**
 * Property-based tests for the device authorization endpoint.
 *
 * Properties tested:
 *   Property 4: Device authorize response completeness and format
 *
 * Feature: cig-auth-provisioning
 *
 * **Validates: Requirements 3.1, 12.1, 12.2**
 */

// Feature: cig-auth-provisioning, Property 4: For any call to POST /api/v1/auth/device/authorize,
// the response should contain a device_code of exactly 32 lowercase hex characters,
// a user_code of exactly 8 alphanumeric characters, a non-empty verification_uri,
// and expires_in: 900.
// Validates: Requirements 3.1, 12.1, 12.2

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { createServer } from '../index';
import type { FastifyInstance } from 'fastify';

// ─── Global configuration ─────────────────────────────────────────────────────

fc.configureGlobal({ numRuns: 100 });

// ─── Regex patterns ───────────────────────────────────────────────────────────

const DEVICE_CODE_PATTERN = /^[0-9a-f]{32}$/;
const USER_CODE_PATTERN = /^[A-Z0-9]{8}$/;

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Property 4: Device authorize response completeness and format', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Use in-memory SQLite for tests
    process.env['DATABASE_URL'] = 'sqlite://:memory:';
    process.env['JWT_SECRET'] = 'test-secret-for-property-tests-at-least-32-chars';
    process.env['VERIFICATION_URI'] = 'https://cig.lat/device';

    app = await createServer();

    // Create the device_auth_records table in the in-memory DB
    const { query } = await import('../db/client');
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
        last_polled_at TEXT,
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await query(`
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

  it('every POST /authorize response has device_code of exactly 32 lowercase hex chars', async () => {
    await fc.assert(
      fc.asyncProperty(
        // We don't need any input — the property holds for every call
        fc.constant(null),
        async () => {
          const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/device/authorize',
            headers: { 'x-api-key': `test-key-${Math.random()}` },
          });

          expect(response.statusCode).toBe(201);
          const body = response.json<{
            device_code: string;
            user_code: string;
            verification_uri: string;
            expires_in: number;
          }>();

          expect(DEVICE_CODE_PATTERN.test(body.device_code)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('every POST /authorize response has user_code of exactly 8 alphanumeric chars', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/device/authorize',
            headers: { 'x-api-key': `test-key-${Math.random()}` },
          });

          expect(response.statusCode).toBe(201);
          const body = response.json<{
            device_code: string;
            user_code: string;
            verification_uri: string;
            expires_in: number;
          }>();

          expect(USER_CODE_PATTERN.test(body.user_code)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('every POST /authorize response has non-empty verification_uri and expires_in: 900', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/device/authorize',
            headers: { 'x-api-key': `test-key-${Math.random()}` },
          });

          expect(response.statusCode).toBe(201);
          const body = response.json<{
            device_code: string;
            user_code: string;
            verification_uri: string;
            expires_in: number;
          }>();

          expect(body.verification_uri).toBeTruthy();
          expect(body.verification_uri.length).toBeGreaterThan(0);
          expect(body.expires_in).toBe(900);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('every POST /authorize response contains all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const response = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/device/authorize',
            headers: { 'x-api-key': `test-key-${Math.random()}` },
          });

          expect(response.statusCode).toBe(201);
          const body = response.json<Record<string, unknown>>();

          // All four required fields must be present
          expect(body).toHaveProperty('device_code');
          expect(body).toHaveProperty('user_code');
          expect(body).toHaveProperty('verification_uri');
          expect(body).toHaveProperty('expires_in');

          // Types
          expect(typeof body['device_code']).toBe('string');
          expect(typeof body['user_code']).toBe('string');
          expect(typeof body['verification_uri']).toBe('string');
          expect(typeof body['expires_in']).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });
});
