/**
 * Node revocation API endpoint.
 *
 * Routes:
 *   DELETE /api/v1/nodes/:id — revoke a node (requireHumanAuth, node must belong to caller)
 *
 * - Sets NodeIdentityRecord.revoked_at for all identity records for this node
 * - Sets managed_nodes.status = 'revoked'
 * - Records an audit event
 * - Returns 204 No Content
 *
 * Requirements: 7.8, 14.9
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { query } from '../../db/client';
import { requireHumanAuth } from '../../middleware/auth';
import type { ManagedNode } from '../../db/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeOnboardingAuditEvent(
  actorType: 'human' | 'node' | 'system',
  actorId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const eventId = crypto.randomUUID();
  await query(
    `INSERT INTO onboarding_audit_events
       (id, actor_type, actor_id, action, resource_type, resource_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventId,
      actorType,
      actorId,
      action,
      resourceType,
      resourceId,
      JSON.stringify(metadata),
      new Date().toISOString(),
    ]
  );
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function nodeRevocationRoutes(app: FastifyInstance): Promise<void> {
  // ── DELETE /api/v1/nodes/:id ───────────────────────────────────────────────
  // Requirements: 7.8, 14.9
  app.delete(
    '/api/v1/nodes/:id',
    { preHandler: [requireHumanAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';

      // ─ Step 1: Verify the node exists and belongs to the authenticated user ──

      const nodeResult = await query<ManagedNode>(
        `SELECT id, user_id, status
           FROM managed_nodes
          WHERE id = ?`,
        [id]
      );

      const managedNode = nodeResult.rows[0];

      if (!managedNode) {
        return reply.status(404).send({
          error: 'Node not found',
          code: 'node_not_found',
          statusCode: 404,
        });
      }

      if (managedNode.user_id !== userId) {
        // Log the unauthorized attempt as an audit event (fire-and-forget)
        writeOnboardingAuditEvent(
          'human',
          userId,
          'node_revocation_unauthorized',
          'managed_node',
          id,
          { requestedBy: userId, ownedBy: managedNode.user_id }
        ).catch(() => {});

        return reply.status(403).send({
          error: 'You do not have permission to revoke this node',
          code: 'forbidden',
          statusCode: 403,
        });
      }

      // ─ Step 2: Check if already revoked ────────────────────────────────────

      if (managedNode.status === 'revoked') {
        return reply.status(409).send({
          error: 'Node is already revoked',
          code: 'already_revoked',
          statusCode: 409,
        });
      }

      const now = new Date().toISOString();

      // ─ Step 3: Set revoked_at on all NodeIdentityRecords for this node ──────

      await query(
        `UPDATE node_identity_records
            SET revoked_at = ?
          WHERE node_id = ?
            AND revoked_at IS NULL`,
        [now, id]
      );

      // ─ Step 4: Set managed_nodes.status = 'revoked' ─────────────────────────

      await query(
        `UPDATE managed_nodes
            SET status = 'revoked', updated_at = ?
          WHERE id = ?`,
        [now, id]
      );

      // ─ Step 5: Record audit event ───────────────────────────────────────────

      await writeOnboardingAuditEvent(
        'human',
        userId,
        'node_revoked',
        'managed_node',
        id,
        { revokedAt: now }
      );

      // ─ Step 6: Return 204 No Content ────────────────────────────────────────

      return reply.status(204).send();
    }
  );
}
