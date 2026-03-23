import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../index';
import { generateJwt, Permission } from '../auth';

function makeAuthHeader(sub: string): string {
  return `Bearer ${generateJwt({ sub, permissions: [Permission.READ_RESOURCES] })}`;
}

let app: FastifyInstance;
let dbQuery: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;

beforeAll(async () => {
  process.env['DATABASE_URL'] = 'sqlite://:memory:';
  process.env['JWT_SECRET'] = 'test-secret-for-scan-unit-tests-at-least-32!!';

  app = await createServer();

  const clientModule = await import('../db/client');
  dbQuery = clientModule.query;

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS scan_results (
      id           TEXT PRIMARY KEY,
      node_id      TEXT NOT NULL,
      scan_type    TEXT NOT NULL,
      provider     TEXT,
      started_at   TEXT NOT NULL,
      completed_at TEXT,
      status       TEXT NOT NULL,
      summary_json TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS scan_assets (
      id            TEXT PRIMARY KEY,
      scan_id       TEXT NOT NULL,
      asset_type    TEXT NOT NULL,
      provider      TEXT NOT NULL,
      identifier    TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
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
      created_at  TEXT NOT NULL
    )
  `);

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await dbQuery('DELETE FROM audit_events');
  await dbQuery('DELETE FROM scan_assets');
  await dbQuery('DELETE FROM scan_results');
});

describe('Scan routes', () => {
  it('stores uploaded scans for the authenticated user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/scans',
      headers: { authorization: makeAuthHeader('user-a') },
      payload: {
        scan_type: 'local',
        status: 'completed',
        summary_json: { hostname: 'host-a' },
        assets: [
          {
            asset_type: 'os',
            provider: 'local',
            identifier: 'host-a-os',
            metadata_json: { platform: 'linux' },
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);

    const result = await dbQuery(`SELECT node_id, scan_type, status FROM scan_results`);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      node_id: 'user-a',
      scan_type: 'local',
      status: 'completed',
    });
  });

  it('lists only the authenticated user scans', async () => {
    await dbQuery(
      `INSERT INTO scan_results (id, node_id, scan_type, provider, started_at, completed_at, status, summary_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['scan-a', 'user-a', 'local', 'local', new Date().toISOString(), new Date().toISOString(), 'completed', '{}']
    );
    await dbQuery(
      `INSERT INTO scan_results (id, node_id, scan_type, provider, started_at, completed_at, status, summary_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['scan-b', 'user-b', 'cloud', 'aws', new Date().toISOString(), new Date().toISOString(), 'completed', '{}']
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scans',
      headers: { authorization: makeAuthHeader('user-a') },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ items: Array<{ id: string }>; total: number }>()).toMatchObject({
      items: [{ id: 'scan-a' }],
      total: 1,
    });
  });

  it('returns 404 when requesting another user scan by id', async () => {
    await dbQuery(
      `INSERT INTO scan_results (id, node_id, scan_type, provider, started_at, completed_at, status, summary_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['scan-b', 'user-b', 'cloud', 'aws', new Date().toISOString(), new Date().toISOString(), 'completed', '{}']
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scans/scan-b',
      headers: { authorization: makeAuthHeader('user-a') },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json<{ code: string }>().code).toBe('scan_not_found');
  });
});
