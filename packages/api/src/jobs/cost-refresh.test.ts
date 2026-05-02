import { beforeEach, describe, expect, it, vi } from 'vitest';

const jobMocks = vi.hoisted(() => ({
  getSummary: vi.fn().mockResolvedValue({
    totalMonthlyCost: 123.45,
    currency: 'USD',
    breakdown: { byProvider: {}, byType: {}, byRegion: {}, byTag: {} },
    trends: {
      '7d': { period: '7d', dataPoints: [], total: 0 },
      '30d': { period: '30d', dataPoints: [], total: 0 },
      '90d': { period: '90d', dataPoints: [], total: 0 },
    },
    resourceCosts: [],
    lastUpdated: '2026-04-01T00:00:00.000Z',
  }),
}));

vi.mock('../costs.js', () => ({
  costAnalyzer: {
    getSummary: jobMocks.getSummary,
  },
}));

import { runCostRefresh } from './cost-refresh.js';

describe('runCostRefresh', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
  };

  beforeEach(() => {
    jobMocks.getSummary.mockClear();
    logger.info.mockClear();
    logger.warn.mockClear();
  });

  it('refreshes the cached infra cost summary and logs the result', async () => {
    await runCostRefresh(logger);

    expect(jobMocks.getSummary).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        totalMonthlyCost: 123.45,
        currency: 'USD',
        lastUpdated: '2026-04-01T00:00:00.000Z',
      }),
      'Infra cost summary refreshed'
    );
  });
});
