/**
 * Heartbeat endpoint.
 *
 * Routes:
 *   POST /api/v1/targets/:id/heartbeat
 *
 * - Verifies Ed25519 signature via node-auth middleware
 * - Updates last_seen, service_status, system_metrics
 * - Emits WebSocket event `target:heartbeat`
 * - Rate-limits to 1 request per 30 seconds per target_id
 *
 * Requirements 8.1–8.9, 14.1–14.7
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/client';
import { verifyNodeSignature } from '../middleware/node-auth';
import { broadcastHeartbeat } from '../websocket';
import { writeAuditEvent } from '../audit';

// ---------------------------------------------------------------------------
// Per-target rate limiter (1 req / 30 s)
// ---------------------------------------------------------------------------

const HEARTBEAT_RATE_LIMIT_MS = 30_000;
const lastHeartbeatTime = new Map<string, number>();

function checkHeartbeatRateLimit(targetId: string): boolean {
  const now = Date.now();
  const last = lastHeartbeatTime.get(targetId);
  if (last !== undefined && now - last < HEARTBEAT_RATE_LIMIT_MS) {
    return false; // rate limited
  }
  lastHeartbeatTime.set(targetId, now);
  return true;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function heartbeatRoutes(app: FastifyInstance): Promise<void> {
  // Add a content-type parser that captures the raw body so the signature
  // middleware can verify it against the exact bytes received.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body: Buffer, done) => {
      try {
        (req as unknown as { rawBody: Buffer }).rawBody = body;
        const parsed = JSON.parse(body.toString());
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  // POST /api/v1/targets/:id/heartbeat
  app.post(
    '/api/v1/targets/:id/heartbeat',
    { preHandler: [verifyNodeSignature] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      // Rate limit: 1 req / 30 s per target
      if (!checkHeartbeatRateLimit(id)) {
        return reply.status(429).send({
          error: 'Rate limit exceeded: 1 heartbeat per 30 seconds',
          code: 'rate_limited',
          statusCode: 429,
        });
      }

      const body = request.body as {
        service_status?: Record<string, unknown>;
        system_metrics?: Record<string, unknown>;
        cig_version?: string;
      };

      const now = new Date().toISOString();
      const serviceStatus = body?.service_status ?? null;
      const systemMetrics = body?.system_metrics ?? null;
      const cigVersion = body?.cig_version ?? null;

      // Update last_seen, metrics, and set status to 'online' (reconnect case)
      await query(
        `UPDATE managed_targets
            SET last_seen      = ?,
                service_status = ?,
                system_metrics = ?,
                cig_version    = ?,
                status         = 'online'
          WHERE id = ?`,
        [
          now,
          serviceStatus !== null ? JSON.stringify(serviceStatus) : null,
          systemMetrics !== null ? JSON.stringify(systemMetrics) : null,
          cigVersion,
          id,
        ]
      );

      // Emit WebSocket event to connected Dashboard clients
      broadcastHeartbeat(id, {
        target_id: id,
        last_seen: now,
        service_status: serviceStatus,
        system_metrics: systemMetrics,
        cig_version: cigVersion,
      });

      return reply.status(200).send({ ok: true, last_seen: now });
    }
  );
}
