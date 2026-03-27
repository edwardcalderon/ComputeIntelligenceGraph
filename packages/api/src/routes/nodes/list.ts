/**
 * Node list API endpoint.
 *
 * Routes:
 *   GET /api/v1/nodes — list all managed nodes for the authenticated user
 *
 * - Uses requireHumanAuth
 * - Returns all managed_nodes for the authenticated user (user.sub)
 * - Includes latest heartbeat data (last_seen_at, permission_tier, active_connectors)
 * - Returns 200 with array of nodes
 *
 * Requirements: 12.7, 16.7, 17.7
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../../db/client';
import { requireHumanAuth } from '../../middleware/auth';
import type { ManagedNode, HeartbeatRecord, OnboardingIntent } from '../../db/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NodeListItem {
  id: string;
  hostname: string;
  os: string;
  architecture: string;
  ip_address: string;
  install_profile: string;
  mode: string;
  status: string;
  last_seen_at: string | null;
  permission_tier: number;
  cloud_provider: string | null;
  intent_id: string;
  created_at: string;
  // Latest heartbeat extras
  active_connectors: string[];
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function nodeListRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/nodes ──────────────────────────────────────────────────────
  // Requirements: 12.7, 16.7, 17.7
  app.get(
    '/api/v1/nodes',
    { preHandler: [requireHumanAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';

      // Fetch all managed nodes for this user
      const nodesResult = await query<ManagedNode>(
        `SELECT id, user_id, intent_id, hostname, os, architecture, ip_address,
                install_profile, mode, status, last_seen_at, permission_tier, created_at
           FROM managed_nodes
          WHERE user_id = ?
          ORDER BY created_at DESC`,
        [userId]
      );

      const nodes = nodesResult.rows;

      if (nodes.length === 0) {
        return reply.status(200).send({ nodes: [] });
      }

      // Fetch intent data (for cloud_provider) for all nodes
      const intentIds = [...new Set(nodes.map((n) => n.intent_id))];
      const intentPlaceholders = intentIds.map(() => '?').join(', ');
      const intentsResult = await query<OnboardingIntent>(
        `SELECT id, cloud_provider FROM onboarding_intents WHERE id IN (${intentPlaceholders})`,
        intentIds
      );
      const intentMap = new Map<string, string>();
      for (const intent of intentsResult.rows) {
        intentMap.set(intent.id, intent.cloud_provider);
      }

      // Fetch latest heartbeat for each node (for active_connectors)
      const nodeIds = nodes.map((n) => n.id);
      const nodePlaceholders = nodeIds.map(() => '?').join(', ');
      const heartbeatResult = await query<HeartbeatRecord & { node_id: string }>(
        `SELECT h.node_id, h.active_connectors
           FROM heartbeat_records h
           INNER JOIN (
             SELECT node_id, MAX(received_at) AS max_received_at
               FROM heartbeat_records
              WHERE node_id IN (${nodePlaceholders})
              GROUP BY node_id
           ) latest ON h.node_id = latest.node_id AND h.received_at = latest.max_received_at`,
        nodeIds
      );
      const heartbeatMap = new Map<string, string[]>();
      for (const hb of heartbeatResult.rows) {
        const connectors = Array.isArray(hb.active_connectors)
          ? hb.active_connectors
          : (JSON.parse(hb.active_connectors as unknown as string) as string[]);
        heartbeatMap.set(hb.node_id, connectors);
      }

      // Build response
      const result: NodeListItem[] = nodes.map((node) => ({
        id: node.id,
        hostname: node.hostname,
        os: node.os,
        architecture: node.architecture,
        ip_address: node.ip_address,
        install_profile: node.install_profile,
        mode: node.mode,
        status: node.status,
        last_seen_at: node.last_seen_at ? new Date(node.last_seen_at).toISOString() : null,
        permission_tier: node.permission_tier,
        cloud_provider: intentMap.get(node.intent_id) ?? null,
        intent_id: node.intent_id,
        created_at: new Date(node.created_at).toISOString(),
        active_connectors: heartbeatMap.get(node.id) ?? [],
      }));

      return reply.status(200).send({ nodes: result });
    }
  );
}
