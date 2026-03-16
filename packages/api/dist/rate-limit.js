"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = createRateLimiter;
function createRateLimiter(limit = 100, windowMs = 60_000) {
    const store = new Map();
    function getClientId(request) {
        const apiKey = request.headers['x-api-key'];
        if (apiKey) {
            return `key:${Array.isArray(apiKey) ? apiKey[0] : apiKey}`;
        }
        return `ip:${request.ip}`;
    }
    return async function rateLimitHandler(request, reply) {
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
//# sourceMappingURL=rate-limit.js.map