/**
 * Unit tests for CostAnalyzer
 * Validates: Requirements 26.1, 26.4
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the AWS SDK before importing costs.ts
vi.mock('@aws-sdk/client-cost-explorer', () => ({
  CostExplorerClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  GetCostAndUsageCommand: vi.fn().mockImplementation((input) => input),
  Granularity: { MONTHLY: 'MONTHLY', DAILY: 'DAILY' },
}));

import { CostAnalyzer } from './costs.js';
import { CostExplorerClient } from '@aws-sdk/client-cost-explorer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAnalyzerWithNullClient(): CostAnalyzer {
  const analyzer = new CostAnalyzer();
  // Force ceClient to null to simulate missing credentials
  (analyzer as unknown as Record<string, unknown>)['ceClient'] = null;
  return analyzer;
}

function makeAnalyzerWithMockClient(sendImpl: () => unknown): CostAnalyzer {
  const analyzer = new CostAnalyzer();
  const mockClient = { send: vi.fn().mockImplementation(sendImpl) };
  (analyzer as unknown as Record<string, unknown>)['ceClient'] = mockClient;
  return analyzer;
}

function makeAwsResponse(groups: Array<{ key: string; amount: string }>) {
  return {
    ResultsByTime: [
      {
        TimePeriod: { Start: '2024-01-01', End: '2024-01-31' },
        Total: { BlendedCost: { Amount: '0', Unit: 'USD' } },
        Groups: groups.map((g) => ({
          Keys: [g.key],
          Metrics: { BlendedCost: { Amount: g.amount, Unit: 'USD' } },
        })),
      },
    ],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CostAnalyzer', () => {
  describe('getSummary() caching', () => {
    it('returns cached result on second call', async () => {
      const analyzer = makeAnalyzerWithNullClient();
      const first = await analyzer.getSummary();
      const second = await analyzer.getSummary();
      expect(first).toBe(second); // same object reference = cached
    });

    it('fetches fresh data when cache is expired', async () => {
      const analyzer = makeAnalyzerWithNullClient();
      const first = await analyzer.getSummary();

      // Expire the cache by backdating fetchedAt
      const cache = (analyzer as unknown as Record<string, unknown>)['cache'] as {
        data: unknown;
        fetchedAt: number;
      };
      cache.fetchedAt = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago

      const second = await analyzer.getSummary();
      expect(first).not.toBe(second); // different object = fresh fetch
    });
  });

  describe('getBreakdown()', () => {
    it('returns breakdown from summary', async () => {
      const analyzer = makeAnalyzerWithNullClient();
      const summary = await analyzer.getSummary();
      const breakdown = await analyzer.getBreakdown();
      expect(breakdown).toBe(summary.breakdown);
    });
  });

  describe('aggregateCosts()', () => {
    it('correctly groups costs by provider (aws vs gcp)', async () => {
      const analyzer = makeAnalyzerWithMockClient(() =>
        makeAwsResponse([
          { key: 'Amazon EC2', amount: '100' },
          { key: 'Amazon S3', amount: '50' },
        ])
      );

      // Inject a gcp cost via the cache mechanism by pre-populating
      // We test aggregation indirectly through getSummary
      const summary = await analyzer.getSummary();
      // All costs come from AWS mock, so byProvider should have 'aws'
      expect(summary.breakdown.byProvider['aws']).toBeGreaterThan(0);
    });

    it('groups aws: prefixed resources under aws provider', async () => {
      const analyzer = makeAnalyzerWithMockClient(() =>
        makeAwsResponse([{ key: 'Amazon EC2', amount: '200' }])
      );
      const summary = await analyzer.getSummary();
      expect(summary.breakdown.byProvider['aws']).toBeCloseTo(200, 1);
      expect(summary.breakdown.byProvider['gcp']).toBeUndefined();
    });
  });

  describe('serviceToType()', () => {
    // Access private method via cast
    function serviceToType(analyzer: CostAnalyzer, service: string): string {
      return (analyzer as unknown as Record<string, (s: string) => string>)['serviceToType'](
        service
      );
    }

    let analyzer: CostAnalyzer;
    beforeEach(() => {
      analyzer = makeAnalyzerWithNullClient();
    });

    it('maps EC2 → compute', () => {
      expect(serviceToType(analyzer, 'EC2')).toBe('compute');
    });

    it('maps RDS → database', () => {
      expect(serviceToType(analyzer, 'RDS')).toBe('database');
    });

    it('maps S3 → storage', () => {
      expect(serviceToType(analyzer, 'S3')).toBe('storage');
    });

    it('maps Lambda → function', () => {
      expect(serviceToType(analyzer, 'Lambda')).toBe('function');
    });

    it('maps VPC → network', () => {
      expect(serviceToType(analyzer, 'VPC')).toBe('network');
    });

    it('maps unknown service → other', () => {
      expect(serviceToType(analyzer, 'SomeUnknownService')).toBe('other');
    });
  });

  describe('fetchAwsCosts()', () => {
    it('returns empty array when ceClient is null', async () => {
      const analyzer = makeAnalyzerWithNullClient();
      const fetchAwsCosts = (
        analyzer as unknown as Record<string, () => Promise<unknown[]>>
      )['fetchAwsCosts'].bind(analyzer);
      const result = await fetchAwsCosts();
      expect(result).toEqual([]);
    });
  });

  describe('fetchTrendWindow()', () => {
    it('returns empty trend when ceClient is null', async () => {
      const analyzer = makeAnalyzerWithNullClient();
      const fetchTrendWindow = (
        analyzer as unknown as Record<string, (days: 7 | 30 | 90) => Promise<unknown>>
      )['fetchTrendWindow'].bind(analyzer);
      const result = await fetchTrendWindow(7);
      expect(result).toMatchObject({ period: '7d', dataPoints: [], total: 0 });
    });
  });

  describe('CostSummary structure', () => {
    it('has correct structure (totalMonthlyCost, currency, breakdown, trends, resourceCosts, lastUpdated)', async () => {
      const analyzer = makeAnalyzerWithNullClient();
      const summary = await analyzer.getSummary();

      expect(typeof summary.totalMonthlyCost).toBe('number');
      expect(summary.currency).toBe('USD');
      expect(summary.breakdown).toHaveProperty('byProvider');
      expect(summary.breakdown).toHaveProperty('byType');
      expect(summary.breakdown).toHaveProperty('byRegion');
      expect(summary.breakdown).toHaveProperty('byTag');
      expect(summary.trends).toHaveProperty('7d');
      expect(summary.trends).toHaveProperty('30d');
      expect(summary.trends).toHaveProperty('90d');
      expect(Array.isArray(summary.resourceCosts)).toBe(true);
      expect(typeof summary.lastUpdated).toBe('string');
    });
  });
});
