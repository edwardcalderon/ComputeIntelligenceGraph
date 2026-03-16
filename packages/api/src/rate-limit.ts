import { FastifyRequest, FastifyReply } from 'fastify';

interface ClientWindow {
  count: number;
  windowStart: number;
}

export function createRateLimiter(limit = 100, windowMs = 60_000) {
  const store = new Map<string, ClientWindow>();

  function getClientId(request: FastifyRequest): string {
    const apiKey = request.headers['x-api-key'];
    if (apiKey) {
      return `key:${Array.isArray(apiKey) ? apiKey[0] : apiKey}`;
    }
    return `ip:${request.ip}`;
  }

  return async function rateLimitHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const clientId = getClientId(request);
    const now = Date.now();

    let window = store.get(clientId);

    if (!window || now - window.windowStart >= windowMs) {
      window = { count: 1, windowStart: now };
      store.set(clientId, window);
      return;
    }

    window.count += 1;

    if (window.count > limit) {
      const retryAfter = Math.ceil((window.windowStart + windowMs - now) / 1000);
      reply
        .status(429)
        .header('Retry-After', String(retryAfter))
        .send({ error: 'Rate limit exceeded', statusCode: 429, retryAfter });
      return;
    }
  };
}
