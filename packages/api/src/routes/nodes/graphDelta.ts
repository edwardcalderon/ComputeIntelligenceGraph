/**
 * Graph-delta API endpoint.
 *
 * Routes:
 *   POST /api/v1/nodes/:id/graph-delta — validate Ed25519 signature, apply graph delta,
 *                                         record InstallationEvent, write audit event
 *
 * - Validates Ed25519 signature via requireNodeAuth middleware
 * - Verifies URL nodeId matches authenticated nodeId
 * - Validates required GraphDelta fields (nodeId, deltaType, timestamp, scanId)
 * - Validates deltaType is one of 'full' | 'targeted' | 'drift'
 * - Calls applyDelta from @cig/graph (gracefully skipped if unavailable)
 * - Records InstallationEvent with event_type 'graph_delta_received'
 * - Writes audit event
 *
 * Requirements: 8.9, 8.10, 17.6
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { query } from '../../db/client';
import { requireNodeAuth } from '../../middleware/auth';
import { indexGraphDeltaResources, type SemanticScope } from '../../semantic-rag';
import type { GraphDelta } from '@cig/sdk';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DELTA_TYPES = ['full', 'targeted', 'drift'] as const;

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

export async function nodeGraphDeltaRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /api/v1/nodes/:id/graph-delta ────────────────────────────────────
  // Requirements: 8.9, 8.10, 17.6
  app.post(
    '/api/v1/nodes/:id/graph-delta',
    { preHandler: [requireNodeAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const nodeId = request.nodeId; // Set by requireNodeAuth middleware

      // ─ Step 1: Verify URL nodeId matches authenticated nodeId ──────────────

      if (nodeId !== id) {
        await writeOnboardingAuditEvent(
          'node',
          nodeId ?? 'unknown',
          'graph_delta_node_id_mismatch',
          'node',
          id,
          { authenticatedNodeId: nodeId }
        );

        return reply.status(401).send({
          error: 'Node ID in URL does not match authenticated node identity',
          code: 'node_id_mismatch',
          statusCode: 401,
        });
      }

      // ─ Step 2: Parse and validate GraphDelta body ──────────────────────────

      const body = request.body as Partial<GraphDelta> | null | undefined;

      if (!body) {
        return reply.status(400).send({
          error: 'Request body is required',
          code: 'missing_body',
          statusCode: 400,
        });
      }

      const { deltaType, timestamp, scanId } = body;
      const bodyNodeId = body.nodeId;

      // Validate nodeId
      if (!bodyNodeId || typeof bodyNodeId !== 'string') {
        return reply.status(400).send({
          error: 'Missing or invalid field: nodeId',
          code: 'invalid_node_id',
          statusCode: 400,
        });
      }

      // Validate deltaType
      if (!deltaType || typeof deltaType !== 'string') {
        return reply.status(400).send({
          error: 'Missing or invalid field: deltaType',
          code: 'invalid_delta_type',
          statusCode: 400,
        });
      }

      if (!(VALID_DELTA_TYPES as readonly string[]).includes(deltaType)) {
        return reply.status(400).send({
          error: `Invalid deltaType: must be one of [${VALID_DELTA_TYPES.join(', ')}]`,
          code: 'invalid_delta_type',
          statusCode: 400,
        });
      }

      // Validate timestamp
      if (!timestamp || typeof timestamp !== 'string') {
        return reply.status(400).send({
          error: 'Missing or invalid field: timestamp',
          code: 'invalid_timestamp',
          statusCode: 400,
        });
      }

      // Validate scanId
      if (!scanId || typeof scanId !== 'string') {
        return reply.status(400).send({
          error: 'Missing or invalid field: scanId',
          code: 'invalid_scan_id',
          statusCode: 400,
        });
      }

      const delta = body as GraphDelta;

      // ─ Step 3: Apply delta to Neo4j graph ─────────────────────────────────

      try {
        const graphModule = await import('@cig/graph');
        if (typeof (graphModule as Record<string, unknown>)['applyDelta'] === 'function') {
          const { applyDelta } = graphModule as unknown as { applyDelta: (delta: GraphDelta, driver: unknown) => Promise<void> };
          const { getDriver } = graphModule;
          await applyDelta(delta, getDriver());
        } else {
          request.log.warn(
            { nodeId, scanId, deltaType },
            'applyDelta not available in @cig/graph — skipping graph write'
          );
        }

        let semanticScope: SemanticScope | undefined;
        if (process.env.CIG_AUTH_MODE === 'managed') {
          const managedNodeResult = await query<{ user_id: string; tenant: string | null }>(
            `SELECT user_id, tenant
               FROM managed_nodes
              WHERE id = ?
              LIMIT 1`,
            [nodeId]
          );

          const managedNode = managedNodeResult.rows[0];
          if (managedNode) {
            semanticScope = {
              deploymentMode: 'managed',
              userId: managedNode.user_id,
              tenant: managedNode.tenant,
            };
          }
        }

        await indexGraphDeltaResources(
          {
            additions: delta.additions ?? [],
            modifications: delta.modifications ?? [],
            deletions: delta.deletions ?? [],
          },
          semanticScope,
          request.log
        );
      } catch (err) {
        request.log.warn(
          { err, nodeId, scanId, deltaType },
          'Failed to apply graph delta — skipping graph write gracefully'
        );
      }

      // ─ Step 4: Record InstallationEvent ───────────────────────────────────

      const nowIso = new Date().toISOString();
      const eventId = crypto.randomUUID();

      await query(
        `INSERT INTO installation_events
           (id, node_id, event_type, payload, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          eventId,
          nodeId,
          'graph_delta_received',
          JSON.stringify({
            deltaType,
            scanId,
            timestamp,
            additionsCount: delta.additions?.length ?? 0,
            modificationsCount: delta.modifications?.length ?? 0,
            deletionsCount: delta.deletions?.length ?? 0,
          }),
          nowIso,
        ]
      );

      // ─ Step 5: Write audit event ───────────────────────────────────────────

      await writeOnboardingAuditEvent(
        'node',
        nodeId,
        'graph_delta_received',
        'node',
        nodeId,
        {
          deltaType,
          scanId,
          timestamp,
          additionsCount: delta.additions?.length ?? 0,
          modificationsCount: delta.modifications?.length ?? 0,
          deletionsCount: delta.deletions?.length ?? 0,
        }
      );

      // ─ Step 6: Return success response ────────────────────────────────────

      return reply.status(200).send({
        ok: true,
        nodeId,
        scanId,
        deltaType,
      });
    }
  );
}
