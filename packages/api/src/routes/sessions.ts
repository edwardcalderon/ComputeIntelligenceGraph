/**
 * Session management endpoints.
 *
 * Routes:
 *   GET    /api/v1/sessions              — list active sessions for authenticated user
 *   DELETE /api/v1/sessions/:id          — revoke a session
 *   POST   /api/v1/sessions/:id/heartbeat — update last_active timestamp
 *
 * Phase 1.3: CLI Auth & Session Persistence
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/client';
import { authenticate } from '../auth';
import { writeAuditEvent } from '../audit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() ?? request.ip;
  }
  return request.ip;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/sessions ────────────────────────────────────────────────────
  app.get(
    '/api/v1/sessions',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';

      const result = await query<{
        id: string;
        device_code: string;
        device_name: string | null;
        device_os: string | null;
        device_arch: string | null;
        ip_address: string | null;
        status: string;
        last_active: string;
        created_at: string;
      }>(
        `SELECT id, device_code, device_name, device_os, device_arch,
                ip_address, status, last_active, created_at
           FROM device_sessions
          WHERE user_id = ?
          ORDER BY last_active DESC`,
        [userId]
      );

      return reply.send({ items: result.rows, total: result.rowCount });
    }
  );

  // ── DELETE /api/v1/sessions/:id ─────────────────────────────────────────────
  app.delete(
    '/api/v1/sessions/:id',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';
      const ipAddress = getClientIp(request);

      const result = await query(
        `UPDATE device_sessions
            SET status = 'revoked', revoked_at = ?
          WHERE id = ? AND user_id = ? AND status = 'active'`,
        [new Date().toISOString(), id, userId]
      );

      if (result.rowCount === 0) {
        return reply.status(404).send({
          error: 'Session not found or already revoked',
          code: 'session_not_found',
          statusCode: 404,
        });
      }

      writeAuditEvent(app, 'session_revoked', userId, ipAddress, 'success', { session_id: id });
      return reply.send({ success: true });
    }
  );

  // ── POST /api/v1/sessions/:id/heartbeat ─────────────────────────────────────
  app.post(
    '/api/v1/sessions/:id/heartbeat',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';

      const result = await query(
        `UPDATE device_sessions
            SET last_active = ?
          WHERE id = ? AND user_id = ? AND status = 'active'`,
        [new Date().toISOString(), id, userId]
      );

      if (result.rowCount === 0) {
        return reply.status(404).send({
          error: 'Session not found or not active',
          code: 'session_not_found',
          statusCode: 404,
        });
      }

      return reply.send({ success: true });
    }
  );
}
