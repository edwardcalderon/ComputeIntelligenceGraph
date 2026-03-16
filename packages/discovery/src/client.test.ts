import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CartographyClient } from './client.js';

function makeFetchMock(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  });
}

describe('CartographyClient', () => {
  let client: CartographyClient;

  beforeEach(() => {
    client = new CartographyClient('http://localhost:8001');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── triggerRun ─────────────────────────────────────────────────────────────

  it('triggerRun() makes POST to /run', async () => {
    const fetchMock = makeFetchMock(200, { status: 'started' });
    vi.stubGlobal('fetch', fetchMock);

    await client.triggerRun();

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8001/run', { method: 'POST' });
  });

  it('triggerRun() returns the response body', async () => {
    vi.stubGlobal('fetch', makeFetchMock(200, { status: 'started', timestamp: '2024-01-01T00:00:00' }));

    const result = await client.triggerRun();

    expect(result.status).toBe('started');
  });

  it('triggerRun() throws on non-2xx response', async () => {
    vi.stubGlobal('fetch', makeFetchMock(500, {}));

    await expect(client.triggerRun()).rejects.toThrow('/run failed');
  });

  // ── getStatus ──────────────────────────────────────────────────────────────

  it('getStatus() makes GET to /status', async () => {
    const fetchMock = makeFetchMock(200, { running: false, run_count: 0, last_run_start: null, last_run_end: null, last_run_success: null, last_error: null });
    vi.stubGlobal('fetch', fetchMock);

    await client.getStatus();

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8001/status');
  });

  it('getStatus() returns status fields', async () => {
    const body = { running: true, run_count: 3, last_run_start: null, last_run_end: null, last_run_success: null, last_error: null };
    vi.stubGlobal('fetch', makeFetchMock(200, body));

    const result = await client.getStatus();

    expect(result.running).toBe(true);
    expect(result.run_count).toBe(3);
  });

  it('getStatus() throws on non-2xx response', async () => {
    vi.stubGlobal('fetch', makeFetchMock(503, {}));

    await expect(client.getStatus()).rejects.toThrow('/status failed');
  });

  // ── getRecentRuns ──────────────────────────────────────────────────────────

  it('getRecentRuns() makes GET to /runs', async () => {
    const fetchMock = makeFetchMock(200, { total_runs: 5, last_success: true, last_run: null });
    vi.stubGlobal('fetch', fetchMock);

    await client.getRecentRuns();

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8001/runs');
  });

  it('getRecentRuns() returns run data', async () => {
    vi.stubGlobal('fetch', makeFetchMock(200, { total_runs: 5, last_success: true, last_run: '2024-01-01T00:00:00' }));

    const result = await client.getRecentRuns();

    expect(result.total_runs).toBe(5);
    expect(result.last_success).toBe(true);
  });

  it('getRecentRuns() throws on non-2xx response', async () => {
    vi.stubGlobal('fetch', makeFetchMock(404, {}));

    await expect(client.getRecentRuns()).rejects.toThrow('/runs failed');
  });

  // ── healthCheck ────────────────────────────────────────────────────────────

  it('healthCheck() makes GET to /health', async () => {
    const fetchMock = makeFetchMock(200, { status: 'ok' });
    vi.stubGlobal('fetch', fetchMock);

    await client.healthCheck();

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8001/health');
  });

  it('healthCheck() returns true on 200', async () => {
    vi.stubGlobal('fetch', makeFetchMock(200, { status: 'ok' }));

    const result = await client.healthCheck();

    expect(result).toBe(true);
  });

  it('healthCheck() returns false on non-2xx', async () => {
    vi.stubGlobal('fetch', makeFetchMock(503, {}));

    const result = await client.healthCheck();

    expect(result).toBe(false);
  });

  it('healthCheck() returns false when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await client.healthCheck();

    expect(result).toBe(false);
  });
});
