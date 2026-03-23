/**
 * Scan result endpoints.
 *
 * Routes:
 *   POST /api/v1/scans           — upload scan results
 *   GET  /api/v1/scans           — list past scans
 *   GET  /api/v1/scans/:id       — get scan details with assets
 *
 * Phase 3.2: Cartography Scan Service
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
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
// Types
// ---------------------------------------------------------------------------

interface ScanAssetInput {
  asset_type: string;
  provider: string;
  identifier: string;
  metadata_json?: Record<string, unknown>;
}

interface ScanUploadBody {
  scan_type: 'local' | 'cloud' | 'all';
  provider?: string;
  status?: 'completed' | 'failed';
  summary_json?: Record<string, unknown>;
  assets?: ScanAssetInput[];
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function scanRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /api/v1/scans ──────────────────────────────────────────────────────
  app.post(
    '/api/v1/scans',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as ScanUploadBody | undefined;
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';
      const ipAddress = getClientIp(request);

      if (!body?.scan_type) {
        return reply.status(400).send({
          error: 'Missing required field: scan_type',
          code: 'missing_scan_type',
          statusCode: 400,
        });
      }

      // Limit asset count to prevent resource exhaustion
      const MAX_ASSETS = 1000;
      if (body.assets && body.assets.length > MAX_ASSETS) {
        return reply.status(400).send({
          error: `Too many assets (max ${MAX_ASSETS})`,
          code: 'too_many_assets',
          statusCode: 400,
        });
      }

      const scanId = crypto.randomUUID();
      const now = new Date().toISOString();

      await query(
        `INSERT INTO scan_results (id, node_id, scan_type, provider, started_at, completed_at, status, summary_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          scanId,
          userId,
          body.scan_type,
          body.provider ?? null,
          now,
          body.status === 'completed' || body.status === 'failed' ? now : null,
          body.status ?? 'completed',
          JSON.stringify(body.summary_json ?? {}),
        ]
      );

      // Insert assets if provided
      if (body.assets && Array.isArray(body.assets)) {
        for (const asset of body.assets) {
          const assetId = crypto.randomUUID();
          await query(
            `INSERT INTO scan_assets (id, scan_id, asset_type, provider, identifier, metadata_json)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [assetId, scanId, asset.asset_type, asset.provider, asset.identifier, JSON.stringify(asset.metadata_json ?? {})]
          );
        }
      }

      writeAuditEvent(app, 'scan_uploaded', userId, ipAddress, 'success', {
        scan_id: scanId,
        scan_type: body.scan_type,
        asset_count: body.assets?.length ?? 0,
      });

      return reply.status(201).send({
        scan_id: scanId,
        status: body.status ?? 'completed',
        asset_count: body.assets?.length ?? 0,
      });
    }
  );

  // ── GET /api/v1/scans ───────────────────────────────────────────────────────
  app.get(
    '/api/v1/scans',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const queryParams = request.query as { limit?: string; offset?: string };
      const limit = Math.min(parseInt(queryParams.limit ?? '50', 10) || 50, 100);
      const offset = Math.max(parseInt(queryParams.offset ?? '0', 10) || 0, 0);

      const result = await query<{
        id: string;
        scan_type: string;
        provider: string | null;
        started_at: string;
        completed_at: string | null;
        status: string;
        summary_json: string;
      }>(
        `SELECT id, scan_type, provider, started_at, completed_at, status, summary_json
           FROM scan_results
          ORDER BY started_at DESC
          LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      return reply.send({ items: result.rows, total: result.rowCount });
    }
  );

  // ── GET /api/v1/scans/:id ──────────────────────────────────────────────────
  app.get(
    '/api/v1/scans/:id',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const scanResult = await query<{
        id: string;
        scan_type: string;
        provider: string | null;
        started_at: string;
        completed_at: string | null;
        status: string;
        summary_json: string;
      }>(
        `SELECT id, scan_type, provider, started_at, completed_at, status, summary_json
           FROM scan_results WHERE id = ?`,
        [id]
      );

      if (scanResult.rows.length === 0) {
        return reply.status(404).send({
          error: 'Scan not found',
          code: 'scan_not_found',
          statusCode: 404,
        });
      }

      const assetsResult = await query<{
        id: string;
        asset_type: string;
        provider: string;
        identifier: string;
        metadata_json: string;
      }>(
        `SELECT id, asset_type, provider, identifier, metadata_json
           FROM scan_assets WHERE scan_id = ?
          ORDER BY asset_type, provider`,
        [id]
      );

      return reply.send({
        scan: scanResult.rows[0],
        assets: assetsResult.rows,
      });
    }
  );
}
