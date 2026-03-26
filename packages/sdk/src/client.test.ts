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
});
