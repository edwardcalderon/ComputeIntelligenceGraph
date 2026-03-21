/**
 * Audit endpoints.
 *
 * Routes:
 *   GET /api/v1/audit — paginated audit events for admin users
 *
 * Requirement 18: Audit Logging
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/client';
import { authenticate, authorize, Permission } from '../auth';

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/audit ──────────────────────────────────────────────────────
  // Requirement 18.4 — paginated audit events for authenticated admin users
  app.get(
    '/api/v1/audit',
    { preHandler: [authenticate, authorize([Permission.ADMIN])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { limit = '50', offset = '0' } = request.query as {
        limit?: string;
        offset?: string;
      };

      const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
      const pageOffset = Math.max(parseInt(offset, 10) || 0, 0);

      // Get total count
      const countResult = await query<{ count: number }>(
        `SELECT COUNT(*) AS count FROM audit_events`
      );
      const total = Number(countResult.rows[0]?.count ?? 0);

      // Get paginated events
      const result = await query<{
        id: string;
        event_type: string;
        actor: string;
        ip_address: string;
        outcome: 'success' | 'failure';
        metadata: string | null;
        created_at: string;
      }>(
        `SELECT id, event_type, actor, ip_address, outcome, metadata, created_at
           FROM audit_events
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`,
        [pageLimit, pageOffset]
      );

      const events = result.rows.map((row) => ({
        id: row.id,
        event_type: row.event_type,
        actor: row.actor,
        ip_address: row.ip_address,
        outcome: row.outcome,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        created_at: row.created_at,
      }));

      return reply.send({
        items: events,
        total,
        limit: pageLimit,
        offset: pageOffset,
      });
    }
  );
}
