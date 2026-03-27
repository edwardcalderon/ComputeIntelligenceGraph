import type { FastifyBaseLogger } from 'fastify';
import { listObservedSemanticScopes, syncSemanticIndex } from '../semantic-rag';

const SEMANTIC_SYNC_INTERVAL_MS = 15 * 60 * 1000;

type SemanticLogger = Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export async function runSemanticIndexSync(logger?: SemanticLogger): Promise<void> {
  const observedScopes = listObservedSemanticScopes();
  const results = await Promise.all([
    syncSemanticIndex(undefined, logger),
    ...observedScopes.map((scope) => syncSemanticIndex(scope, logger)),
  ]);

  const indexed = results.reduce((sum, result) => sum + result.indexed, 0);
  logger?.info?.(
    {
      indexed,
      scopes: observedScopes.length,
    },
    'Semantic graph index sync completed'
  );
}

export function startSemanticIndexSync(logger?: SemanticLogger): void {
  if (intervalHandle !== null) {
    return;
  }

  void runSemanticIndexSync(logger).catch((error) => {
    logger?.warn?.({ err: error }, 'Initial semantic graph index sync failed');
  });

  intervalHandle = setInterval(() => {
    void runSemanticIndexSync(logger).catch((error) => {
      logger?.warn?.({ err: error }, 'Semantic graph index sync failed');
    });
  }, SEMANTIC_SYNC_INTERVAL_MS);

  if (intervalHandle.unref) {
    intervalHandle.unref();
  }
}

export function stopSemanticIndexSync(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
