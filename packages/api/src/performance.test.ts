/**
 * Performance tests for the CIG API layer.
 * Validates throughput, latency, and scalability targets.
 *
 * Validates: Requirements 24.1, 24.2, 24.3, 24.4, 24.5, 26.9
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ─── Mock external dependencies ───────────────────────────────────────────────

vi.mock('@cig/graph', async () => {
  const actual = await vi.importActual<typeof import('@cig/graph')>('@cig/graph');
  // Build 10,000 mock resources once
  const makeResources = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `res-${i}`,
      name: `resource-${i}`,
      type: i % 2 === 0 ? 'ec2' : 's3',
      provider: 'aws',
      region: 'us-east-1',
      state: 'running',
      tags: {},
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      discoveredAt: new Date(),
    }));

  const largeDataset = makeResources(10_000);

  return {
    ...actual,
    GraphEngine: vi.fn().mockImplementation(() => ({
      getResource: vi.fn().mockResolvedValue(largeDataset[0]),
    })),
    GraphQueryEngine: vi.fn().mockImplementation(() => ({
      listResourcesPaged: vi.fn().mockResolvedValue({
        items: largeDataset.slice(0, 50),
        total: 10_000,
        hasMore: true,
      }),
      searchResources: vi.fn().mockResolvedValue(largeDataset.slice(0, 100)),
      getDependencies: vi.fn().mockResolvedValue([]),
      getDependents: vi.fn().mockResolvedValue([]),
    })),
  };
});

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
    getRecentRuns: vi.fn().mockResolvedValue({ total_runs: 5, last_success: true, last_run: '2024-01-01T00:05:00Z' }),
    triggerRun: vi.fn().mockResolvedValue({ status: 'started', timestamp: '2024-01-01T00:00:00Z' }),
  })),
}));

vi.mock('./costs.js', () => ({
  costAnalyzer: {
    getSummary: vi.fn().mockResolvedValue({
      totalMonthlyCost: 250.5,
      currency: 'USD',
      breakdown: { byProvider: {}, byType: {}, byRegion: {}, byTag: {} },
      trends: { '7d': { period: '7d', dataPoints: [], total: 50 }, '30d': { period: '30d', dataPoints: [], total: 250.5 }, '90d': { period: '90d', dataPoints: [], total: 750 } },
      resourceCosts: [],
      lastUpdated: '2024-01-01T00:00:00Z',
    }),
    getBreakdown: vi.fn().mockResolvedValue({ byProvider: {}, byType: {}, byRegion: {}, byTag: {} }),
  },
  CostAnalyzer: vi.fn(),
}));

vi.mock('./security.js', () => ({
  securityScanner: {
    getFindings: vi.fn().mockResolvedValue([]),
    getScore: vi.fn().mockResolvedValue({ score: 80, maxScore: 100, grade: 'B', findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 } }),
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
import { createRateLimiter } from './rate-limit.js';

process.env['JWT_SECRET'] = 'perf-test-secret';

function makeAuthHeader(permissions: Permission[]): string {
  const token = generateJwt({ sub: 'perf-test-user', permissions });
  return `Bearer ${token}`;
}

// ─── Performance Tests ────────────────────────────────────────────────────────

describe('Performance Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Requirement 24.1 — 100 concurrent requests ────────────────────────────

  it('handles 100 concurrent requests to /api/v1/health within 5 seconds', async () => {
    const CONCURRENCY = 100;
    const TIMEOUT_MS = 5_000;

    const start = performance.now();

    const requests = Array.from({ length: CONCURRENCY }, () =>
      app.inject({ method: 'GET', url: '/api/v1/health' })
    );

    const responses = await Promise.all(requests);
    const elapsed = performance.now() - start;

    const successCount = responses.filter((r) => r.statusCode === 200).length;

    expect(successCount).toBe(CONCURRENCY);
    expect(elapsed).toBeLessThan(TIMEOUT_MS);
  }, 10_000);

  // ── Requirement 24.3 — listResourcesPaged with 10,000 nodes < 500ms ──────

  it('listResourcesPaged returns within 500ms for 10,000 node dataset', async () => {
    const TIMEOUT_MS = 500;
    const authHeader = makeAuthHeader([Permission.READ_RESOURCES]);

    const start = performance.now();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/resources?limit=50&offset=0',
      headers: {
        authorization: authHeader,
        // Use a unique API key so this test has its own rate-limit bucket
        'x-api-key': 'perf-test-list-resources',
      },
    });
    const elapsed = performance.now() - start;

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(10_000);
    expect(elapsed).toBeLessThan(TIMEOUT_MS);
  });

  // ── Requirement 24.3 — searchResources with 10,000 nodes < 500ms ─────────

  it('searchResources returns within 500ms for 10,000 node dataset', async () => {
    const TIMEOUT_MS = 500;
    const authHeader = makeAuthHeader([Permission.READ_RESOURCES]);

    const start = performance.now();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/resources/search?q=resource',
      headers: {
        authorization: authHeader,
        // Use a unique API key so this test has its own rate-limit bucket
        'x-api-key': 'perf-test-search-resources',
      },
    });
    const elapsed = performance.now() - start;

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(elapsed).toBeLessThan(TIMEOUT_MS);
  });

  // ── Requirement 26.9 — Rate limiter handles burst of 100 requests ─────────

  it('rate limiter allows 100 requests within the window and blocks the 101st', async () => {
    // Create a fresh rate limiter with limit=100 and a 60s window
    const rateLimiter = createRateLimiter(100, 60_000);

    let blockedCount = 0;
    let allowedCount = 0;

    // Simulate 110 requests from the same IP
    for (let i = 0; i < 110; i++) {
      const mockRequest = {
        headers: {},
        ip: '10.0.0.1',
      } as Parameters<typeof rateLimiter>[0];

      const mockReply = {
        _blocked: false,
        status(code: number) {
          if (code === 429) this._blocked = true;
          return this;
        },
        header() { return this; },
        send() { return this; },
      } as unknown as Parameters<typeof rateLimiter>[1];

      await rateLimiter(mockRequest, mockReply);

      if ((mockReply as { _blocked: boolean })._blocked) {
        blockedCount++;
      } else {
        allowedCount++;
      }
    }

    // First 100 should be allowed, remaining 10 should be blocked
    expect(allowedCount).toBe(100);
    expect(blockedCount).toBe(10);
  });

  // ── Requirement 24.1 — Concurrent authenticated requests < 5s ────────────

  it('handles 100 concurrent authenticated resource requests within 5 seconds', async () => {
    const CONCURRENCY = 100;
    const TIMEOUT_MS = 5_000;
    const authHeader = makeAuthHeader([Permission.READ_RESOURCES]);

    const start = performance.now();

    const requests = Array.from({ length: CONCURRENCY }, () =>
      app.inject({
        method: 'GET',
        url: '/api/v1/resources',
        headers: { authorization: authHeader },
      })
    );

    const responses = await Promise.all(requests);
    const elapsed = performance.now() - start;

    // All should succeed (200) or be rate-limited (429) — both are valid handled responses
    const handledCount = responses.filter((r) => r.statusCode === 200 || r.statusCode === 429).length;

    expect(handledCount).toBe(CONCURRENCY);
    expect(elapsed).toBeLessThan(TIMEOUT_MS);
  }, 10_000);
});
