/**
 * SSE (Server-Sent Events) for node status change notifications.
 *
 * Pushes real-time node status events to connected Dashboard clients.
 *
 * Requirements: 12.8, 16.10
 */

import type { ServerResponse } from 'http';
import { query } from '../db/client';
import type { ManagedNode } from '../db/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NodeStatusEventType = 'notification' | 'alert';

export interface NodeStatusEvent {
  nodeId: string;
  status: string;
  eventType: NodeStatusEventType;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// In-memory subscriber map: userId → Set<ServerResponse>
// ---------------------------------------------------------------------------

const subscribers = new Map<string, Set<ServerResponse>>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sendSSE(res: ServerResponse, event: string, data: string): void {
  try {
    res.write(`event: ${event}\ndata: ${data}\n\n`);
  } catch {
    // client disconnected — will be cleaned up on 'close'
  }
}

function sendComment(res: ServerResponse, comment: string): void {
  try {
    res.write(`:${comment}\n\n`);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Subscribe / unsubscribe
// ---------------------------------------------------------------------------

export function subscribeUser(userId: string, res: ServerResponse): void {
  let set = subscribers.get(userId);
  if (!set) {
    set = new Set();
    subscribers.set(userId, set);
  }
  set.add(res);
}

export function unsubscribeUser(userId: string, res: ServerResponse): void {
  const set = subscribers.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    subscribers.delete(userId);
  }
}

// ---------------------------------------------------------------------------
// Push event (called by heartbeat handler and nodeStatusChecker)
// ---------------------------------------------------------------------------

/**
 * Push a node status change event to all connected Dashboard SSE clients
 * that own the given node.
 */
export async function pushNodeStatusEvent(event: NodeStatusEvent): Promise<void> {
  // Look up which user owns this node
  let userId: string | null = null;
  try {
    const result = await query<Pick<ManagedNode, 'user_id'>>(
      `SELECT user_id FROM managed_nodes WHERE id = ?`,
      [event.nodeId]
    );
    userId = result.rows[0]?.user_id ?? null;
  } catch (err) {
    console.error('[sse/nodeStatus] DB lookup failed for node', event.nodeId, err);
    return;
  }

  if (!userId) {
    console.warn('[sse/nodeStatus] No owner found for node', event.nodeId);
    return;
  }

  const set = subscribers.get(userId);
  if (!set || set.size === 0) return;

  const data = JSON.stringify(event);
  for (const res of set) {
    sendSSE(res, 'node-status', data);
  }
}

// ---------------------------------------------------------------------------
// Fastify route plugin
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireHumanAuth } from '../middleware/auth';

const KEEPALIVE_INTERVAL_MS = 30_000;

export async function nodeSSERoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/nodes/sse — stream node status events to Dashboard
  // Requirements: 12.8, 16.10
  app.get(
    '/api/v1/nodes/sse',
    { preHandler: [requireHumanAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user as { sub?: string; id?: string } | undefined;
      const userId = user?.sub ?? user?.id ?? null;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized', statusCode: 401 });
      }

      const res = reply.raw;

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
      res.flushHeaders();

      // Register subscriber
      subscribeUser(userId, res);

      // Send initial connected event
      sendSSE(res, 'connected', JSON.stringify({ userId }));

      // Keepalive every 30 seconds
      const keepaliveTimer = setInterval(() => {
        sendComment(res, 'keepalive');
      }, KEEPALIVE_INTERVAL_MS);

      // Cleanup on client disconnect
      request.raw.on('close', () => {
        clearInterval(keepaliveTimer);
        unsubscribeUser(userId, res);
      });

      // Keep the connection open — do not call reply.send()
      await new Promise<void>((resolve) => {
        request.raw.on('close', resolve);
      });
    }
  );
}
