/**
 * Unit tests for rate limiting middleware
 * Validates: Requirement 5.6
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { createRateLimitMiddleware, createRateLimitConfig } from '../lib/rate-limit.js';

describe('Rate Limit Middleware', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  describe('createRateLimitMiddleware', () => {
    it('should allow requests within the rate limit', async () => {
      const middleware = createRateLimitMiddleware({
        requestsPerWindow: 3,
        windowDurationMs: 1000,
        logEvents: false,
      });

      app.use('*', middleware);
      app.get('/test', (c) => c.json({ status: 'ok' }));

      // Make 3 requests (at the limit)
      for (let i = 0; i < 3; i++) {
        const res = await app.request(new Request('http://localhost/test'));
        expect(res.status).toBe(200);
      }
    });

    it('should reject requests exceeding the rate limit', async () => {
      const middleware = createRateLimitMiddleware({
        requestsPerWindow: 2,
        windowDurationMs: 1000,
        logEvents: false,
      });

      app.use('*', middleware);
      app.get('/test', (c) => c.json({ status: 'ok' }));

      // Make 2 requests (at the limit)
      for (let i = 0; i < 2; i++) {
        const res = await app.request(new Request('http://localhost/test'));
        expect(res.status).toBe(200);
      }

      // Third request should be rejected
      const res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(429);
    });

    it('should return 429 with error response schema', async () => {
      const middleware = createRateLimitMiddleware({
        requestsPerWindow: 1,
        windowDurationMs: 1000,
        logEvents: false,
      });

      app.use('*', middleware);
      app.get('/test', (c) => c.json({ status: 'ok' }));

      // Make 1 request (at the limit)
      await app.request(new Request('http://localhost/test'));

      // Second request should be rejected with proper error schema
      const res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(429);

      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('code');
      expect(body).toHaveProperty('requestId');
      expect(body.error).toBe('rate_limited');
      expect(body.code).toBe('RATE_LIMITED');
    });

    it('should include Retry-After header on rate limit', async () => {
      const middleware = createRateLimitMiddleware({
        requestsPerWindow: 1,
        windowDurationMs: 5000, // 5 seconds
        logEvents: false,
      });

      app.use('*', middleware);
      app.get('/test', (c) => c.json({ status: 'ok' }));

      // Make 1 request (at the limit)
      await app.request(new Request('http://localhost/test'));

      // Second request should include Retry-After header
      const res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(429);
      expect(res.headers.has('Retry-After')).toBe(true);

      const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(5);
    });

    it('should reset rate limit after window expires', async () => {
      const middleware = createRateLimitMiddleware({
        requestsPerWindow: 1,
        windowDurationMs: 100, // 100ms window
        logEvents: false,
      });

      app.use('*', middleware);
      app.get('/test', (c) => c.json({ status: 'ok' }));

      // Make 1 request (at the limit)
      let res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(200);

      // Second request should be rejected
      res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(429);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Third request should be allowed (new window)
      res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(200);
    });

    it('should track separate clients by IP address', async () => {
      const middleware = createRateLimitMiddleware({
        requestsPerWindow: 1,
        windowDurationMs: 1000,
        useApiKeyIfAvailable: false,
        logEvents: false,
      });

      app.use('*', middleware);
      app.get('/test', (c) => c.json({ status: 'ok' }));

      // Request from client 1
      let res = await app.request(
        new Request('http://localhost/test', {
          headers: { 'x-forwarded-for': '192.168.1.1' },
        }),
      );
      expect(res.status).toBe(200);

      // Second request from client 1 should be rejected
      res = await app.request(
        new Request('http://localhost/test', {
          headers: { 'x-forwarded-for': '192.168.1.1' },
        }),
      );
      expect(res.status).toBe(429);

      // Request from client 2 should be allowed (different IP)
      res = await app.request(
        new Request('http://localhost/test', {
          headers: { 'x-forwarded-for': '192.168.1.2' },
        }),
      );
      expect(res.status).toBe(200);
    });

    it('should track separate clients by API key when enabled', async () => {
      const middleware = createRateLimitMiddleware({
        requestsPerWindow: 1,
        windowDurationMs: 1000,
        useApiKeyIfAvailable: true,
        logEvents: false,
      });

      app.use('*', middleware);
      app.get('/test', (c) => c.json({ status: 'ok' }));

      // Request from client 1 with API key
      let res = await app.request(
        new Request('http://localhost/test', {
          headers: { 'x-api-key': 'key1' },
        }),
      );
      expect(res.status).toBe(200);

      // Second request from client 1 should be rejected
      res = await app.request(
        new Request('http://localhost/test', {
          headers: { 'x-api-key': 'key1' },
        }),
      );
      expect(res.status).toBe(429);

      // Request from client 2 with different API key should be allowed
      res = await app.request(
        new Request('http://localhost/test', {
          headers: { 'x-api-key': 'key2' },
        }),
      );
      expect(res.status).toBe(200);
    });

    it('should prefer API key over IP when useApiKeyIfAvailable is true', async () => {
      const middleware = createRateLimitMiddleware({
        requestsPerWindow: 1,
        windowDurationMs: 1000,
        useApiKeyIfAvailable: true,
        logEvents: false,
      });

      app.use('*', middleware);
      app.get('/test', (c) => c.json({ status: 'ok' }));

      // Request with API key
      let res = await app.request(
        new Request('http://localhost/test', {
          headers: {
            'x-api-key': 'key1',
            'x-forwarded-for': '192.168.1.1',
          },
        }),
      );
      expect(res.status).toBe(200);

      // Second request with same API key but different IP should be rejected
      // (because API key is used for rate limiting, not IP)
      res = await app.request(
        new Request('http://localhost/test', {
          headers: {
            'x-api-key': 'key1',
            'x-forwarded-for': '192.168.1.2',
          },
        }),
      );
      expect(res.status).toBe(429);
    });

    it('should support Bearer token in Authorization header', async () => {
      const middleware = createRateLimitMiddleware({
        requestsPerWindow: 1,
        windowDurationMs: 1000,
        useApiKeyIfAvailable: true,
        logEvents: false,
      });

      app.use('*', middleware);
      app.get('/test', (c) => c.json({ status: 'ok' }));

      // Request with Bearer token
      let res = await app.request(
        new Request('http://localhost/test', {
          headers: { Authorization: 'Bearer token1' },
        }),
      );
      expect(res.status).toBe(200);

      // Second request with same Bearer token should be rejected
      res = await app.request(
        new Request('http://localhost/test', {
          headers: { Authorization: 'Bearer token1' },
        }),
      );
      expect(res.status).toBe(429);
    });

    it('should handle requests without IP header gracefully', async () => {
      const middleware = createRateLimitMiddleware({
        requestsPerWindow: 2,
        windowDurationMs: 1000,
        useApiKeyIfAvailable: false,
        logEvents: false,
      });

      app.use('*', middleware);
      app.get('/test', (c) => c.json({ status: 'ok' }));

      // Make requests without IP header (should use 'unknown')
      for (let i = 0; i < 2; i++) {
        const res = await app.request(new Request('http://localhost/test'));
        expect(res.status).toBe(200);
      }

      // Third request should be rejected
      const res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(429);
    });

    it('should allow middleware to be applied selectively', async () => {
      const middleware = createRateLimitMiddleware({
        requestsPerWindow: 1,
        windowDurationMs: 1000,
        logEvents: false,
      });

      app.use('/api/*', middleware);
      app.get('/api/test', (c) => c.json({ status: 'ok' }));
      app.get('/health', (c) => c.json({ status: 'ok' }));

      // Rate limited endpoint
      let res = await app.request(new Request('http://localhost/api/test'));
      expect(res.status).toBe(200);

      res = await app.request(new Request('http://localhost/api/test'));
      expect(res.status).toBe(429);

      // Non-rate-limited endpoint should work multiple times
      res = await app.request(new Request('http://localhost/health'));
      expect(res.status).toBe(200);

      res = await app.request(new Request('http://localhost/health'));
      expect(res.status).toBe(200);
    });

    it('should calculate correct Retry-After value', async () => {
      const middleware = createRateLimitMiddleware({
        requestsPerWindow: 1,
        windowDurationMs: 10000, // 10 seconds
        logEvents: false,
      });

      app.use('*', middleware);
      app.get('/test', (c) => c.json({ status: 'ok' }));

      // Make first request
      await app.request(new Request('http://localhost/test'));

      // Wait 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Make second request (should be rejected)
      const res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(429);

      const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
      // Should be approximately 8 seconds (10 - 2)
      expect(retryAfter).toBeGreaterThanOrEqual(7);
      expect(retryAfter).toBeLessThanOrEqual(9);
    });
  });

  describe('createRateLimitConfig', () => {
    it('should create default configuration', () => {
      const config = createRateLimitConfig();
      expect(config.requestsPerWindow).toBe(100);
      expect(config.windowDurationMs).toBe(60000);
      expect(config.useApiKeyIfAvailable).toBe(true);
      expect(config.logEvents).toBe(true);
    });

    it('should create custom configuration', () => {
      const config = createRateLimitConfig(50, 30);
      expect(config.requestsPerWindow).toBe(50);
      expect(config.windowDurationMs).toBe(30000);
      expect(config.useApiKeyIfAvailable).toBe(true);
      expect(config.logEvents).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero window duration gracefully', async () => {
      const middleware = createRateLimitMiddleware({
        requestsPerWindow: 1,
        windowDurationMs: 0,
        logEvents: false,
      });

      app.use('*', middleware);
      app.get('/test', (c) => c.json({ status: 'ok' }));

      // With zero window, timestamps are immediately outside the window
      // so each request starts a new window
      let res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(200);

      // Second request should also be allowed (zero window means no history)
      res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(200);
    });

    it('should handle very large request counts', async () => {
      const middleware = createRateLimitMiddleware({
        requestsPerWindow: 1000,
        windowDurationMs: 1000,
        logEvents: false,
      });

      app.use('*', middleware);
      app.get('/test', (c) => c.json({ status: 'ok' }));

      // Make 1000 requests
      for (let i = 0; i < 1000; i++) {
        const res = await app.request(new Request('http://localhost/test'));
        expect(res.status).toBe(200);
      }

      // 1001st request should be rejected
      const res = await app.request(new Request('http://localhost/test'));
      expect(res.status).toBe(429);
    });

    it('should handle concurrent requests from same client', async () => {
      const middleware = createRateLimitMiddleware({
        requestsPerWindow: 2,
        windowDurationMs: 1000,
        logEvents: false,
      });

      app.use('*', middleware);
      app.get('/test', (c) => c.json({ status: 'ok' }));

      // Make concurrent requests
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(app.request(new Request('http://localhost/test')));
      }

      const results = await Promise.all(promises);
      const successCount = results.filter((r) => r.status === 200).length;
      const rateLimitedCount = results.filter((r) => r.status === 429).length;

      // Should have 2 successes and 3 rate limited
      expect(successCount).toBe(2);
      expect(rateLimitedCount).toBe(3);
    });
  });
});
