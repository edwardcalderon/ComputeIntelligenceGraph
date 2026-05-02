/**
 * Unit tests for the HealthEndpoint HTTP server.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { HealthEndpoint, type HealthEndpointMetadata, type HealthEndpointResponse } from '../health/endpoint.js';
import type { HealthCheckResult } from '../health/recovery.js';
import { Logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createLogger(): Logger {
  return new Logger({
    component: 'test-health-endpoint',
    sessionId: 'test-session',
    writer: () => {}, // suppress output
  });
}

function makeHealthResult(overall: boolean): HealthCheckResult {
  return {
    timestamp: new Date().toISOString(),
    sessionId: 'sess-123',
    checks: {
      session: { healthy: overall, latencyMs: 10, status: overall ? 'running' : 'error' },
      workerHeartbeat: { healthy: overall, latencyMs: 5 },
    },
    overall,
  };
}

function makeMetadata(): HealthEndpointMetadata {
  return {
    sessionId: 'sess-123',
    provider: 'colab',
    startedAt: '2025-01-01T00:00:00.000Z',
    uptimeSeconds: 3600,
  };
}

async function fetchEndpoint(port: number, path: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  const body = await res.text();
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HealthEndpoint', () => {
  let endpoint: HealthEndpoint | null = null;

  afterEach(async () => {
    if (endpoint) {
      await endpoint.stop();
      endpoint = null;
    }
  });

  it('responds with health data on GET /health when healthy', async () => {
    const healthResult = makeHealthResult(true);
    const metadata = makeMetadata();

    endpoint = new HealthEndpoint({
      port: 0, // let OS pick a free port
      getHealthResult: () => healthResult,
      getMetadata: () => metadata,
      logger: createLogger(),
    });

    // Port 0 won't work with our simple start() — use a high random port
    // Actually, node:http supports port 0 and assigns a random port.
    // But our start() doesn't expose the assigned port. Let's use a fixed high port.
    await endpoint.stop(); // reset
    endpoint = null;

    const port = 18787 + Math.floor(Math.random() * 1000);
    endpoint = new HealthEndpoint({
      port,
      getHealthResult: () => healthResult,
      getMetadata: () => metadata,
      logger: createLogger(),
    });

    await endpoint.start();

    const { status, body } = await fetchEndpoint(port, '/health');
    const parsed: HealthEndpointResponse = JSON.parse(body);

    expect(status).toBe(200);
    expect(parsed.status).toBe('ok');
    expect(parsed.metadata).toEqual(metadata);
    expect(parsed.health).toEqual(healthResult);
  });

  it('responds with "unhealthy" status when health check is failing', async () => {
    const healthResult = makeHealthResult(false);
    const metadata = makeMetadata();
    const port = 18787 + Math.floor(Math.random() * 1000);

    endpoint = new HealthEndpoint({
      port,
      getHealthResult: () => healthResult,
      getMetadata: () => metadata,
      logger: createLogger(),
    });

    await endpoint.start();

    const { body } = await fetchEndpoint(port, '/health');
    const parsed: HealthEndpointResponse = JSON.parse(body);

    expect(parsed.status).toBe('unhealthy');
    expect(parsed.health?.overall).toBe(false);
  });

  it('responds with "no_data" when no health check has been performed', async () => {
    const metadata = makeMetadata();
    const port = 18787 + Math.floor(Math.random() * 1000);

    endpoint = new HealthEndpoint({
      port,
      getHealthResult: () => null,
      getMetadata: () => metadata,
      logger: createLogger(),
    });

    await endpoint.start();

    const { body } = await fetchEndpoint(port, '/health');
    const parsed: HealthEndpointResponse = JSON.parse(body);

    expect(parsed.status).toBe('no_data');
    expect(parsed.health).toBeNull();
    expect(parsed.metadata).toEqual(metadata);
  });

  it('responds with null metadata when no session is active', async () => {
    const port = 18787 + Math.floor(Math.random() * 1000);

    endpoint = new HealthEndpoint({
      port,
      getHealthResult: () => null,
      getMetadata: () => null,
      logger: createLogger(),
    });

    await endpoint.start();

    const { body } = await fetchEndpoint(port, '/health');
    const parsed: HealthEndpointResponse = JSON.parse(body);

    expect(parsed.metadata).toBeNull();
  });

  it('returns 404 for non-health paths', async () => {
    const port = 18787 + Math.floor(Math.random() * 1000);

    endpoint = new HealthEndpoint({
      port,
      getHealthResult: () => null,
      getMetadata: () => null,
      logger: createLogger(),
    });

    await endpoint.start();

    const { status, body } = await fetchEndpoint(port, '/other');
    const parsed = JSON.parse(body);

    expect(status).toBe(404);
    expect(parsed.error).toBe('Not found');
  });

  it('start() is idempotent when already listening', async () => {
    const port = 18787 + Math.floor(Math.random() * 1000);

    endpoint = new HealthEndpoint({
      port,
      getHealthResult: () => null,
      getMetadata: () => null,
      logger: createLogger(),
    });

    await endpoint.start();
    // Calling start again should not throw
    await endpoint.start();

    const { status } = await fetchEndpoint(port, '/health');
    expect(status).toBe(200);
  });

  it('stop() is safe to call when not started', async () => {
    endpoint = new HealthEndpoint({
      port: 19999,
      getHealthResult: () => null,
      getMetadata: () => null,
      logger: createLogger(),
    });

    // Should not throw
    await endpoint.stop();
  });
});
