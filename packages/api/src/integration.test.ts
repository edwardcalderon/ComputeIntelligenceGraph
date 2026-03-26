/**
 * Integration tests for the API layer.
 * Tests the full request/response cycle using Fastify's inject() method.
 * Validates: Requirements 26.2
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ─── Mock external dependencies before importing routes ───────────────────────

const graphMocks = vi.hoisted(() => ({
  getResource: vi.fn().mockResolvedValue({
    id: 'res-1',
    name: 'my-ec2',
    type: 'ec2',
    provider: 'aws',
    region: 'us-east-1',
    state: 'running',
    tags: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    discoveredAt: new Date(),
  }),
  listResourcesPaged: vi.fn().mockResolvedValue({
    items: [
      { id: 'res-1', name: 'my-ec2', type: 'ec2', provider: 'aws', region: 'us-east-1', state: 'running', tags: {}, metadata: {} },
      { id: 'res-2', name: 'my-s3', type: 's3', provider: 'aws', region: 'us-east-1', state: 'running', tags: {}, metadata: {} },
    ],
    total: 2,
    hasMore: false,
  }),
  searchResources: vi.fn().mockResolvedValue([
    { id: 'res-1', name: 'test-ec2', type: 'ec2', provider: 'aws', region: 'us-east-1', state: 'running', tags: {}, metadata: {} },
  ]),
  getDependencies: vi.fn().mockResolvedValue([]),
  getDependents: vi.fn().mockResolvedValue([]),
}));

vi.mock('@cig/graph', () => ({
  GraphEngine: vi.fn().mockImplementation(() => ({
    getResource: graphMocks.getResource,
  })),
  GraphQueryEngine: vi.fn().mockImplementation(() => ({
    listResourcesPaged: graphMocks.listResourcesPaged,
    searchResources: graphMocks.searchResources,
    getDependencies: graphMocks.getDependencies,
    getDependents: graphMocks.getDependents,
  })),
  Resource_Model: {},
}));

vi.mock('@cig/discovery', () => ({
  CartographyClient: vi.fn().mockImplementation(() => ({
    getStatus: vi.fn().mockResolvedValue({
      running: false,
      run_count: 5,
      last_run_start: '2024-01-01T00:00:00Z',
      last_run_end: '2024-01-01T00:05:00Z',
      last_run_success: true,
      last_error: null,
    }),
    getRecentRuns: vi.fn().mockResolvedValue({
      total_runs: 5,
      last_success: true,
      last_run: '2024-01-01T00:05:00Z',
    }),
    triggerRun: vi.fn().mockResolvedValue({ status: 'started', timestamp: '2024-01-01T00:00:00Z' }),
  })),
}));

vi.mock('./costs.js', () => ({
  costAnalyzer: {
    getSummary: vi.fn().mockResolvedValue({
      totalMonthlyCost: 250.5,
      currency: 'USD',
      breakdown: { byProvider: { aws: 250.5 }, byType: { compute: 150 }, byRegion: { 'us-east-1': 250.5 }, byTag: {} },
      trends: {
        '7d': { period: '7d', dataPoints: [], total: 50 },
        '30d': { period: '30d', dataPoints: [], total: 250.5 },
        '90d': { period: '90d', dataPoints: [], total: 750 },
      },
      resourceCosts: [],
      lastUpdated: '2024-01-01T00:00:00Z',
    }),
    getBreakdown: vi.fn().mockResolvedValue({ byProvider: {}, byType: {}, byRegion: {}, byTag: {} }),
  },
  CostAnalyzer: vi.fn(),
}));

vi.mock('./security.js', () => ({
  securityScanner: {
    getFindings: vi.fn().mockResolvedValue([
      {
        id: 'finding_S3_PUBLIC_READ_res-1_1',
        resourceId: 'res-1',
        severity: 'critical',
        title: 'S3 bucket allows public read access',
        description: 'Remediation: Remove the public-read ACL.',
        category: 'public-access',
        status: 'open',
      },
    ]),
    getScore: vi.fn().mockResolvedValue({
      score: 80,
      maxScore: 100,
      grade: 'B',
      findingsBySeverity: { critical: 1, high: 0, medium: 0, low: 0 },
    }),
    getScanResult: vi.fn(),
  },
  SecurityScanner: vi.fn(),
}));

// ─── Mock prom-client to avoid real metrics registration ─────────────────────

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

// ─── Test setup ───────────────────────────────────────────────────────────────

// Set JWT_SECRET for tests
process.env['JWT_SECRET'] = 'test-secret-for-integration-tests';

function makeAuthHeader(permissions: Permission[]): string {
  const token = generateJwt({ sub: 'test-user', permissions });
  return `Bearer ${token}`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('API Integration Tests', () => {
  let app: FastifyInstance;
  const originalOpenAiKey = process.env['OPENAI_API_KEY'];
  const originalOpenAiModel = process.env['OPENAI_CHAT_MODEL'];

  beforeAll(async () => {
    process.env['OPENAI_API_KEY'] = '';
    process.env['OPENAI_CHAT_MODEL'] = 'gpt-4o-mini';
    app = await createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    if (originalOpenAiKey === undefined) {
      delete process.env['OPENAI_API_KEY'];
    } else {
      process.env['OPENAI_API_KEY'] = originalOpenAiKey;
    }
    if (originalOpenAiModel === undefined) {
      delete process.env['OPENAI_CHAT_MODEL'];
    } else {
      process.env['OPENAI_CHAT_MODEL'] = originalOpenAiModel;
    }
  });

  // ── Health ──────────────────────────────────────────────────────────────────

  describe('GET /api/v1/health', () => {
    it('returns 200 with status: ok', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('ok');
      expect(typeof body.version).toBe('string');
      expect(typeof body.timestamp).toBe('string');
      expect(body.chat).toMatchObject({
        provider: 'fallback',
        model: 'gpt-4o-mini',
        configured: false,
        reachable: false,
      });
      expect(typeof body.chat.checkedAt).toBe('string');
    });
  });

  // ── Resources ───────────────────────────────────────────────────────────────

  describe('GET /api/v1/resources', () => {
    it('returns 200 with items array when authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources',
        headers: {
          authorization: makeAuthHeader([Permission.READ_RESOURCES]),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body.items)).toBe(true);
    });

    it('returns an empty paged response when the graph query fails', async () => {
      graphMocks.listResourcesPaged.mockRejectedValueOnce(new Error('neo4j unavailable'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources?limit=1',
        headers: {
          authorization: makeAuthHeader([Permission.READ_RESOURCES]),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ items: [], total: 0, hasMore: false });
    });

    it('returns 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources',
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources',
        headers: {
          authorization: 'Bearer invalid.token.here',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── Resource Search ─────────────────────────────────────────────────────────

  describe('GET /api/v1/resources/search', () => {
    it('returns 200 with items array for valid query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources/search?q=test',
        headers: {
          authorization: makeAuthHeader([Permission.READ_RESOURCES]),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body.items)).toBe(true);
      expect(typeof body.total).toBe('number');
    });

    it('returns 400 when q parameter is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/resources/search',
        headers: {
          authorization: makeAuthHeader([Permission.READ_RESOURCES]),
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ── Discovery ───────────────────────────────────────────────────────────────

  describe('GET /api/v1/discovery/status', () => {
    it('returns 200 with running/lastRun fields', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery/status',
        headers: {
          authorization: makeAuthHeader([Permission.READ_RESOURCES]),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(typeof body.running).toBe('boolean');
    });
  });

  describe('POST /api/v1/discovery/trigger', () => {
    it('returns 202 with MANAGE_DISCOVERY permission', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/discovery/trigger',
        headers: {
          authorization: makeAuthHeader([Permission.MANAGE_DISCOVERY]),
        },
      });

      expect(response.statusCode).toBe(202);
    });

    it('returns 403 without MANAGE_DISCOVERY permission', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/discovery/trigger',
        headers: {
          authorization: makeAuthHeader([Permission.READ_RESOURCES]),
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('returns 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/discovery/trigger',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── Costs ───────────────────────────────────────────────────────────────────

  describe('GET /api/v1/costs', () => {
    it('returns 200 with totalMonthlyCost', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/costs',
        headers: {
          authorization: makeAuthHeader([Permission.READ_RESOURCES]),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(typeof body.totalMonthlyCost).toBe('number');
      expect(body.currency).toBe('USD');
    });
  });

  // ── Security ────────────────────────────────────────────────────────────────

  describe('GET /api/v1/security/findings', () => {
    it('returns 200 with items array', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/security/findings',
        headers: {
          authorization: makeAuthHeader([Permission.READ_RESOURCES]),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body.items)).toBe(true);
      expect(typeof body.total).toBe('number');
    });
  });

  describe('GET /api/v1/security/score', () => {
    it('returns 200 with score and grade', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/security/score',
        headers: {
          authorization: makeAuthHeader([Permission.READ_RESOURCES]),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(typeof body.score).toBe('number');
      expect(typeof body.grade).toBe('string');
    });
  });

  // ── Actions ─────────────────────────────────────────────────────────────────

  describe('POST /api/v1/actions/execute', () => {
    it('returns 202 with valid body and EXECUTE_ACTIONS permission', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/actions/execute',
        headers: {
          authorization: makeAuthHeader([Permission.EXECUTE_ACTIONS]),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: 'stop',
          resourceId: 'res-1',
          parameters: {},
        }),
      });

      expect(response.statusCode).toBe(202);
      const body = response.json();
      expect(body.status).toBe('accepted');
      expect(typeof body.actionId).toBe('string');
    });

    it('returns 400 when action field is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/actions/execute',
        headers: {
          authorization: makeAuthHeader([Permission.EXECUTE_ACTIONS]),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ resourceId: 'res-1' }),
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 403 without EXECUTE_ACTIONS permission', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/actions/execute',
        headers: {
          authorization: makeAuthHeader([Permission.READ_RESOURCES]),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'stop', resourceId: 'res-1' }),
      });

      expect(response.statusCode).toBe(403);
    });

    it('returns 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/actions/execute',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'stop', resourceId: 'res-1' }),
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── Auth Email ───────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/send-otp', () => {
    it('returns 400 for invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/send-otp',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'invalid-email,' }),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: 'Missing or invalid email' });
    });
  });

  describe('POST /api/v1/auth/send-magic-link', () => {
    it('returns 400 for invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/send-magic-link',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email@' }),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: 'Missing or invalid email' });
    });
  });
});
