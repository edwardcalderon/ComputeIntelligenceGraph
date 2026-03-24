import { defineConfig } from 'vitest/config';

const isCI = process.env.CI === '1' || process.env.CI === 'true';

export default defineConfig({
  test: {
    // The API suite registers global Prometheus metrics and touches shared
    // database state. CI has been unstable with the default worker pool, so we
    // force a single fork there to keep the suite isolated without changing
    // local developer ergonomics.
    pool: isCI ? 'forks' : 'threads',
    poolOptions: isCI
      ? {
          forks: {
            maxForks: 1,
            minForks: 1,
          },
        }
      : undefined,
  },
});
