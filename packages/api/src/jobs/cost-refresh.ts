import type { FastifyBaseLogger } from 'fastify';
import { costAnalyzer } from '../costs';

const COST_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

type CostRefreshLogger = Pick<FastifyBaseLogger, 'info' | 'warn'>;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export async function runCostRefresh(logger?: CostRefreshLogger): Promise<void> {
  const summary = await costAnalyzer.getSummary();

  logger?.info?.(
    {
      totalMonthlyCost: summary.totalMonthlyCost,
      currency: summary.currency,
      lastUpdated: summary.lastUpdated,
    },
    'Infra cost summary refreshed'
  );
}

export function startCostRefresh(logger?: CostRefreshLogger): void {
  if (intervalHandle !== null) {
    return;
  }

  void runCostRefresh(logger).catch((error) => {
    logger?.warn?.({ err: error }, 'Initial infra cost refresh failed');
  });

  intervalHandle = setInterval(() => {
    void runCostRefresh(logger).catch((error) => {
      logger?.warn?.({ err: error }, 'Infra cost summary refresh failed');
    });
  }, COST_REFRESH_INTERVAL_MS);

  if (intervalHandle.unref) {
    intervalHandle.unref();
  }
}

export function stopCostRefresh(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
