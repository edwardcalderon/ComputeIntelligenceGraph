/**
 * Security tests for the CIG API layer.
 * Tests authentication bypass, injection attacks, XSS, rate limiting, and JWT tampering.
 * Validates: Requirements 26.1
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ─── Mock external dependencies ───────────────────────────────────────────────

vi.mock('@cig/graph', async () => {
  const actual = await vi.importActual<typeof import('@cig/graph')>('@cig/graph');
  return {
    ...actual,
    GraphEngine: vi.fn().mockImplementation(() => ({
      getResource: vi.fn().mockResolvedValue(null),
      executeCypher: vi.fn().mockResolvedValue({ rowCount: 0 }),
    })),
    GraphQueryEngine: vi.fn().mockImplementation(() => ({
      listResourcesPaged: vi.fn().mockResolvedValue({ items: [], total: 0, hasMore: false }),
      searchResources: vi.fn().mockResolvedValue([]),
      getDependencies: vi.fn().mockResolvedValue([]),
      getDependents: vi.fn().mockResolvedValue([]),
      listRelationships: vi.fn().mockResolvedValue([]),
    })),
  };
});

vi.mock('@cig/discovery', () => ({
  CartographyClient: vi.fn().mockImplementation(() => ({
    getStatus: vi.fn().mockResolvedValue({ running: false }),
    getRecentRuns: vi.fn().mockResolvedValue({ total_runs: 0 }),
    triggerRun: vi.fn().mockResolvedValue({ status: 'started' }),
  })),
}));

vi.mock('./costs.js', () => ({
  costAnalyzer: {
    getSummary: vi.fn().mockResolvedValue({ totalMonthlyCost: 0, currency: 'USD', breakdown: {}, trends: {}, resourceCosts: [], lastUpdated: '' }),
    getBreakdown: vi.fn().mockResolvedValue({}),
  },
  CostAnalyzer: vi.fn(),
}));

vi.mock('./security.js', () => ({
  securityScanner: {
    getFindings: vi.fn().mockResolvedValue([]),
    getScore: vi.fn().mockResolvedValue({ score: 100, maxScore: 100, grade: 'A', findingsBySeverity: {} }),
    getScanResult: vi.fn(),
  },
  SecurityScanner: vi.fn(),
}));

vi.mock('prom-client', () => {
  const registry = { metrics: vi.fn().mockResolvedValue(''), contentType: 'text/plain' };
  const mockClient = {
    Registry: vi.fn().mockImplementation(() => registry),
    Counter: vi.fn().mockImplementation(() => ({ inc: vi.fn(), labels: vi.fn().mockReturnThis() })),
    Histogram: vi.fn().mockImplementation(() => ({ observe: vi.fn(), labels: vi.fn().mockReturnThis() })),
    Gauge: vi.fn().mockImplementation(() => ({ set: vi.fn() })),
    collectDefaultMetrics: vi.fn(),
    register: registry,
  };
  return { default: mockClient, ...mockClient };
});

import { createServer } from './index.js';
import { generateJwt, Permission } from './auth.js';

// ─── Setup ────────────────────────────────────────────────────────────────────

process.env['JWT_SECRET'] = 'test-secret-for-security-tests';

function validToken(permissions: Permission[] = [Permission.READ_RESOURCES]): string {
  return `Bearer ${generateJwt({ sub: 'test-user', permissions })}`;
}

// ─── Protected endpoints to test for auth bypass ──────────────────────────────

const PROTECTED_ENDPOINTS: Array<{ method: 'GET' | 'POST'; url: string; body?: unknown }> = [
  { method: 'GET', url: '/api/v1/resources' },
  { method: 'GET', url: '/api/v1/resources/search?q=test' },
  { method: 'GET', url: '/api/v1/resources/some-id' },
  { method: 'GET', url: '/api/v1/resources/some-id/dependencies' },
  { method: 'GET', url: '/api/v1/resources/some-id/dependents' },
  { method: 'GET', url: '/api/v1/relationships' },
  { method: 'GET', url: '/api/v1/graph/snapshot' },
  { method: 'GET', url: '/api/v1/discovery/status' },
  { method: 'POST', url: '/api/v1/discovery/trigger' },
  { method: 'POST', url: '/api/v1/graph/query', body: { query: 'MATCH (n) RETURN n' } },
  { method: 'POST', url: '/api/v1/graph/refine', body: { goal: 'test', proposal: { summary: 'x', proposedCypher: 'MATCH (n) RETURN n', previewDiff: [], requiresApproval: true } } },
  { method: 'GET', url: '/api/v1/costs' },
  { method: 'GET', url: '/api/v1/costs/breakdown' },
  { method: 'GET', url: '/api/v1/security/findings' },
  { method: 'GET', url: '/api/v1/security/score' },
  { method: 'POST', url: '/api/v1/actions/execute', body: { action: 'stop', resourceId: 'r1' } },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Security Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 1. Authentication Bypass ─────────────────────────────────────────────────

  describe('Authentication bypass — all protected endpoints reject unauthenticated requests', () => {
    for (const endpoint of PROTECTED_ENDPOINTS) {
      it(`${endpoint.method} ${endpoint.url} returns 401 with no auth header`, async () => {
        const response = await app.inject({
          method: endpoint.method,
          url: endpoint.url,
          headers: endpoint.body ? { 'content-type': 'application/json' } : {},
          body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
        });
        expect(response.statusCode).toBe(401);
      });
    }
  });

  // ── 2. Malformed / Missing Authorization Header ──────────────────────────────

  describe('Malformed Authorization header formats', () => {
    it('returns 401 for "Bearer" with no token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources',
        headers: { authorization: 'Bearer' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 401 for "Basic" scheme instead of Bearer', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources',
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 401 for empty Authorization header value', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources',
        headers: { authorization: '' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 401 for Authorization header with only whitespace', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources',
        headers: { authorization: '   ' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 401 for token without Bearer prefix', async () => {
      const token = generateJwt({ sub: 'user', permissions: [Permission.READ_RESOURCES] });
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources',
        headers: { authorization: token }, // missing "Bearer " prefix
      });
      expect(response.statusCode).toBe(401);
    });
  });

  // ── 3. JWT Tampering ─────────────────────────────────────────────────────────

  describe('JWT tampering — modified tokens are rejected', () => {
    it('returns 401 for a token with a tampered payload', async () => {
      const token = generateJwt({ sub: 'user', permissions: [Permission.READ_RESOURCES] });
      const [header, , signature] = token.split('.');
      // Replace payload with admin permissions
      const tamperedPayload = Buffer.from(
        JSON.stringify({ sub: 'attacker', permissions: [Permission.ADMIN], iat: Math.floor(Date.now() / 1000) })
      ).toString('base64url');
      const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources',
        headers: { authorization: `Bearer ${tamperedToken}` },
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 401 for a token signed with a different secret', async () => {
      // Manually sign with wrong secret
      const jwt = await import('jsonwebtoken');
      const wrongToken = jwt.default.sign(
        { sub: 'user', permissions: [Permission.READ_RESOURCES] },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources',
        headers: { authorization: `Bearer ${wrongToken}` },
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 401 for a token with algorithm set to none', async () => {
      // "alg: none" attack — unsigned token
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ sub: 'attacker', permissions: [Permission.ADMIN], iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })
      ).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources',
        headers: { authorization: `Bearer ${noneToken}` },
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 401 for a completely invalid token string', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources',
        headers: { authorization: 'Bearer not.a.valid.jwt.token' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 401 for a token with only two parts (missing signature)', async () => {
      const token = generateJwt({ sub: 'user', permissions: [Permission.READ_RESOURCES] });
      const [header, payload] = token.split('.');
      const truncatedToken = `${header}.${payload}`;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources',
        headers: { authorization: `Bearer ${truncatedToken}` },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  // ── 4. Cypher Injection Prevention ──────────────────────────────────────────

  describe('Cypher injection — graph query endpoint rejects write/destructive queries', () => {
    const injectionPayloads = [
      'CREATE (n:Malicious) RETURN n',
      'DELETE n',
      'MERGE (n:Node) RETURN n',
      'DROP INDEX ON :Resource(id)',
      'DETACH DELETE n',
      'SET n.admin = true',
      'REMOVE n.label',
      'FOREACH (x IN [1] | CREATE (n))',
      '; DROP DATABASE neo4j',
      'MATCH (n) DELETE n',
    ];

    for (const payload of injectionPayloads) {
      it(`rejects query starting with: "${payload.slice(0, 40)}"`, async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/graph/query',
          headers: {
            authorization: validToken(),
            'content-type': 'application/json',
          },
          body: JSON.stringify({ query: payload }),
        });
        expect(response.statusCode).toBe(400);
        const body = response.json();
        expect(body.error).toMatch(/only read queries/i);
      });
    }

    it('allows valid MATCH query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/graph/query',
        headers: {
          authorization: validToken(),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ query: 'MATCH (n) RETURN n LIMIT 10' }),
      });
      expect(response.statusCode).toBe(200);
    });

    it('allows valid CALL query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/graph/query',
        headers: {
          authorization: validToken(),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ query: 'CALL db.labels()' }),
      });
      expect(response.statusCode).toBe(200);
    });

    it('allows valid WITH query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/graph/query',
        headers: {
          authorization: validToken(),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ query: 'WITH 1 AS x RETURN x' }),
      });
      expect(response.statusCode).toBe(200);
    });

    it('returns 400 when query field is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/graph/query',
        headers: {
          authorization: validToken(),
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      expect(response.statusCode).toBe(400);
    });
  });

  // ── 5. XSS in Query Parameters ───────────────────────────────────────────────

  describe('XSS in query parameters — search endpoint handles special characters safely', () => {
    const xssPayloads = [
      '<script>alert(1)</script>',
      '"><img src=x onerror=alert(1)>',
      "'; DROP TABLE resources; --",
      '<svg onload=alert(document.cookie)>',
      'javascript:alert(1)',
      '%3Cscript%3Ealert(1)%3C/script%3E',
      '{{7*7}}',           // template injection
      '${7*7}',            // expression injection
    ];

    for 
(const payload of xssPayloads) {
      it(`search endpoint returns 200 (not 500) for XSS payload: "${payload.slice(0, 30)}"`, async () => {
        const encoded = encodeURIComponent(payload);
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/resources/search?q=${encoded}`,
          headers: { authorization: validToken() },
        });
        // Must not crash the server — 200 or 400 are both acceptable, never 500
        expect(response.statusCode).not.toBe(500);
        // Response must be JSON (not raw HTML that could execute scripts)
        expect(response.headers['content-type']).toMatch(/application\/json/);
      });
    }

    it('search endpoint does not reflect raw script tags in response body', async () => {
      const payload = '<script>alert(1)</script>';
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/resources/search?q=${encodeURIComponent(payload)}`,
        headers: { authorization: validToken() },
      });
      // The raw script tag must not appear unescaped in the JSON response body
      expect(response.body).not.toContain('<script>alert(1)</script>');
    });
  });

  // ── 6. Rate Limiting ─────────────────────────────────────────────────────────

  describe('Rate limiting — 429 returned after exceeding limit', () => {
    it('returns 429 after exceeding 100 requests per minute from same IP on protected routes', async () => {
      // The rate limiter allows 100 req/min. We send 101 requests from the same IP.
      // Use an authenticated endpoint so the health check stays exempt.
      let lastStatus = 200;

      for (let i = 0; i < 101; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/resources',
          headers: { authorization: validToken() },
          remoteAddress: '10.0.0.99', // isolated IP to avoid polluting other tests
        });
        lastStatus = response.statusCode;
        if (lastStatus === 429) break;
      }

      expect(lastStatus).toBe(429);
    });

    it('429 response includes Retry-After header', async () => {
      let rateLimitedResponse: Awaited<ReturnType<typeof app.inject>> | null = null;

      for (let i = 0; i < 102; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/resources',
          headers: { authorization: validToken() },
          remoteAddress: '10.0.0.98',
        });
        if (response.statusCode === 429) {
          rateLimitedResponse = response;
          break;
        }
      }

      expect(rateLimitedResponse).not.toBeNull();
      expect(rateLimitedResponse!.headers['retry-after']).toBeDefined();
    });

    it('rate limit is per-client (different IPs are not affected by each other)', async () => {
      // Send 50 requests from IP A — should not affect IP B
      for (let i = 0; i < 50; i++) {
        await app.inject({
          method: 'GET',
          url: '/api/v1/resources',
          headers: { authorization: validToken() },
          remoteAddress: '10.0.1.1',
        });
      }

      // IP B should still get 200
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources',
        headers: { authorization: validToken() },
        remoteAddress: '10.0.1.2',
      });
      expect(response.statusCode).toBe(200);
    });

    it('uses X-Forwarded-For as the client identity behind the trusted proxy', async () => {
      const proxyIp = '10.0.2.15';
      const clientA = '198.51.100.10';
      const clientB = '198.51.100.11';

      for (let i = 0; i < 101; i++) {
        await app.inject({
          method: 'GET',
          url: '/api/v1/resources',
          headers: {
            authorization: validToken(),
            'x-forwarded-for': clientA,
          },
          remoteAddress: proxyIp,
        });
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources',
        headers: {
          authorization: validToken(),
          'x-forwarded-for': clientB,
        },
        remoteAddress: proxyIp,
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Operational endpoints are exempt from rate limiting', () => {
    it('GET /api/v1/health stays available after repeated requests', async () => {
      for (let i = 0; i < 101; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/health',
          remoteAddress: '10.0.0.97',
        });

        expect(response.statusCode).toBe(200);
      }
    });

    it('GET /metrics stays available after repeated requests', async () => {
      for (let i = 0; i < 101; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/metrics',
          remoteAddress: '10.0.0.96',
        });

        expect(response.statusCode).toBe(200);
      }
    });
  });

  // ── 7. Authorization (Permission Enforcement) ────────────────────────────────

  describe('Authorization — insufficient permissions return 403', () => {
    it('POST /api/v1/discovery/trigger returns 403 without MANAGE_DISCOVERY', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/discovery/trigger',
        headers: { authorization: validToken([Permission.READ_RESOURCES]) },
      });
      expect(response.statusCode).toBe(403);
    });

    it('POST /api/v1/actions/execute returns 403 without EXECUTE_ACTIONS', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/actions/execute',
        headers: {
          authorization: validToken([Permission.READ_RESOURCES]),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'stop', resourceId: 'r1' }),
      });
      expect(response.statusCode).toBe(403);
    });

    it('ADMIN permission grants access to all endpoints', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/discovery/trigger',
        headers: { authorization: validToken([Permission.ADMIN]) },
      });
      expect(response.statusCode).toBe(202);
    });
  });
});
