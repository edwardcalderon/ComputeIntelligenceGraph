import { FastifyRequest, FastifyReply } from 'fastify';
export declare function createRateLimiter(limit?: number, windowMs?: number): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
//# sourceMappingURL=rate-limit.d.ts.map