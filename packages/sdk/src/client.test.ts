import { describe, expect, it, vi } from 'vitest';
import { CigClient } from './client';

describe('CigClient', () => {
  it('binds fetch to the global object before issuing requests', async () => {
    let observedThis: unknown;

    const fetchImpl = vi.fn(function (this: unknown) {
      observedThis = this;
      return Promise.resolve(
        new Response('{"ok":true}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
    });

    const client = new CigClient({
      baseUrl: 'https://api.example.com',
      fetch: fetchImpl as unknown as typeof fetch,
    });

    await client.requestRaw('/api/v1/health');

    expect(observedThis).toBe(globalThis);
  });

  it('fetches dashboard health metadata from the API', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            status: 'ok',
            version: '0.2.15',
            timestamp: '2026-03-26T09:00:00.000Z',
            chat: {
              provider: 'openai',
              model: 'gpt-4o-mini',
              configured: true,
              reachable: true,
              providerReachable: true,
              checkedAt: '2026-03-26T09:00:00.000Z',
              latencyMs: 42,
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      )
    );

    const client = new CigClient({
      baseUrl: 'https://api.example.com',
      fetch: fetchImpl as unknown as typeof fetch,
    });

    const health = await client.getHealth();

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/health',
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
    expect(health.chat.model).toBe('gpt-4o-mini');
    expect(health.chat.reachable).toBe(true);
  });
});
