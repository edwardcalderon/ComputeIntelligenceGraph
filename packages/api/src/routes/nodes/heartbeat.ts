/**
 * Node heartbeat API endpoint.
 *
 * Routes:
 *   POST /api/v1/nodes/:id/heartbeat — validate Ed25519 signature, validate permissionTier,
 *                                       update node lastSeenAt, store HeartbeatRecord,
 *                                       emit SSE event to Dashboard clients
 *
 * - Validates Ed25519 signature via requireNodeAuth middleware
 * - Validates permissionTier in [0,4]
 * - Updates node lastSeenAt timestamp
 * - Stores HeartbeatRecord for audit trail
 * - Emits SSE event to Dashboard clients for real-time status updates
 * - Rate-limits to 1 request per 30 seconds per node (returns 429 if exceeded)
 *
 * Requirements: 16.1–16.10, 17.5
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { query } from '../../db/client';
import { requireNodeAuth } from '../../middleware/auth';
import { pushNodeStatusEvent } from '../../sse/nodeStatus';
import type { HeartbeatPayload } from '@cig/sdk';
import type { ManagedNode } from '../../db/schema';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEARTBEAT_RATE_LIMIT_MS = 30_000;
const VALID_PERMISSION_TIERS = [0, 1, 2, 3, 4];

// ---------------------------------------------------------------------------
// Per-node rate limiter (1 req / 30 s)
// ---------------------------------------------------------------------------

const lastHeartbeatTime = new Map<string, number>();

function checkHeartbeatRateLimit(nodeId: string): boolean {
  const now = Date.now();
  const last = lastHeartbeatTime.get(nodeId);
  if (last !== undefined && now - last < HEARTBEAT_RATE_LIMIT_MS) {
    return false; // rate limited
  }
  lastHeartbeatTime.set(nodeId, now);
  return true;
}

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

export async function nodeHeartbeatRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /api/v1/nodes/:id/heartbeat ───────────────────────────────────────
  // Requirements: 16.1–16.10, 17.5
  app.post(
    '/api/v1/nodes/:id/heartbeat',
    { preHandler: [requireNodeAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const nodeId = request.nodeId; // Set by requireNodeAuth middleware

      // Verify that the nodeId in the URL matches the authenticated node
      if (nodeId !== id) {
        await writeOnboardingAuditEvent(
          'node',
          nodeId ?? 'unknown',
          'heartbeat_node_id_mismatch',
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

      // ─ Step 1: Check rate limit ────────────────────────────────────────────

      if (!checkHeartbeatRateLimit(nodeId)) {
        return reply.status(429).send({
          error: 'Rate limit exceeded: 1 heartbeat per 30 seconds',
          code: 'rate_limited',
          statusCode: 429,
        });
      }

      // ─ Step 2: Parse and validate heartbeat payload ────────────────────────

      const body = request.body as Partial<HeartbeatPayload> | null | undefined;

      if (!body) {
        return reply.status(400).send({
          error: 'Request body is required',
          code: 'missing_body',
          statusCode: 400,
        });
      }

      const { timestamp, serviceHealth, systemMetrics, permissionTier, activeConnectors } = body;

      // Validate timestamp
      if (!timestamp || typeof timestamp !== 'string') {
        return reply.status(400).send({
          error: 'Missing or invalid field: timestamp',
          code: 'invalid_timestamp',
          statusCode: 400,
        });
      }

      // Validate serviceHealth
      if (!serviceHealth || typeof serviceHealth !== 'object') {
        return reply.status(400).send({
          error: 'Missing or invalid field: serviceHealth',
          code: 'invalid_service_health',
          statusCode: 400,
        });
      }

      // Validate systemMetrics
      if (!systemMetrics || typeof systemMetrics !== 'object') {
        return reply.status(400).send({
          error: 'Missing or invalid field: systemMetrics',
          code: 'invalid_system_metrics',
          statusCode: 400,
        });
      }

      const metrics = systemMetrics as Record<string, unknown>;
      if (
        typeof metrics.cpuPercent !== 'number' ||
        typeof metrics.memoryPercent !== 'number' ||
        typeof metrics.diskPercent !== 'number'
      ) {
        return reply.status(400).send({
          error: 'systemMetrics must contain cpuPercent, memoryPercent, diskPercent as numbers',
          code: 'invalid_system_metrics',
          statusCode: 400,
        });
      }

      // Validate permissionTier
      if (permissionTier === undefined || permissionTier === null) {
        return reply.status(400).send({
          error: 'Missing required field: permissionTier',
          code: 'missing_permission_tier',
          statusCode: 400,
        });
      }

      if (!Number.isInteger(permissionTier) || !VALID_PERMISSION_TIERS.includes(permissionTier as number)) {
        return reply.status(400).send({
          error: `Invalid permissionTier: must be one of [${VALID_PERMISSION_TIERS.join(', ')}]`,
          code: 'invalid_permission_tier',
          statusCode: 400,
        });
      }

      // Validate activeConnectors
      if (!Array.isArray(activeConnectors)) {
        return reply.status(400).send({
          error: 'activeConnectors must be an array',
          code: 'invalid_active_connectors',
          statusCode: 400,
        });
      }

      // ─ Step 3: Fetch the managed node ──────────────────────────────────────

      const nodeResult = await query<ManagedNode>(
        `SELECT id, user_id, intent_id, hostname, os, architecture, ip_address,
                install_profile, mode, status, last_seen_at, permission_tier, created_at
           FROM managed_nodes
          WHERE id = ?`,
        [nodeId]
      );

      const managedNode = nodeResult.rows[0];
      if (!managedNode) {
        await writeOnboardingAuditEvent(
          'node',
          nodeId,
          'heartbeat_node_not_found',
          'node',
          nodeId
        );

        return reply.status(404).send({
          error: 'Node not found',
          code: 'node_not_found',
          statusCode: 404,
        });
      }

      // ─ Step 4: Update node lastSeenAt and permission tier ──────────────────

      const now = new Date();
      const nowIso = now.toISOString();

      // Always set status to 'online' on a valid heartbeat (covers offline → online
      // and degraded → online transitions required by Requirements 16.6).
      await query(
        `UPDATE managed_nodes
            SET last_seen_at = ?, permission_tier = ?, status = 'online', updated_at = ?
          WHERE id = ?`,
        [nowIso, permissionTier, nowIso, nodeId]
      );

      // Push SSE notification when a previously offline/degraded node comes back online
      if (managedNode.status === 'offline' || managedNode.status === 'degraded') {
        pushNodeStatusEvent({
          nodeId,
          status: 'online',
          eventType: 'notification',
          timestamp: nowIso,
        });
      }

      // ─ Step 5: Store HeartbeatRecord ───────────────────────────────────────

      const heartbeatId = crypto.randomUUID();
      await query(
        `INSERT INTO heartbeat_records
           (id, node_id, received_at, service_health, system_metrics, permission_tier, active_connectors)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          heartbeatId,
          nodeId,
          nowIso,
          JSON.stringify(serviceHealth),
          JSON.stringify(systemMetrics),
          permissionTier,
          JSON.stringify(activeConnectors),
        ]
      );

      // ─ Step 6: Record InstallationEvent ────────────────────────────────────

      const eventId = crypto.randomUUID();
      await query(
        `INSERT INTO installation_events
           (id, node_id, event_type, payload, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          eventId,
          nodeId,
          'heartbeat_received',
          JSON.stringify({
            timestamp,
            serviceHealth,
            systemMetrics,
            permissionTier,
            activeConnectors,
          }),
          nowIso,
        ]
      );

      // ─ Step 7: Write audit event ───────────────────────────────────────────

      await writeOnboardingAuditEvent(
        'node',
        nodeId,
        'heartbeat_received',
        'node',
        nodeId,
        {
          permissionTier,
          activeConnectorsCount: activeConnectors.length,
          serviceHealthKeys: Object.keys(serviceHealth),
        }
      );

      // ─ Step 9: Return success response ─────────────────────────────────────

      return reply.status(200).send({
        ok: true,
        nodeId,
        lastSeenAt: nowIso,
        permissionTier,
      });
    }
  );
}
