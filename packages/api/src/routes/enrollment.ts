/**
 * Target enrollment endpoints.
 *
 * Routes:
 *   POST /api/v1/targets/enrollment-token  — issue UUID token (10-min expiry, single-use)
 *   POST /api/v1/targets/enroll            — validate token, generate Ed25519 key pair + target_id
 *   GET  /api/v1/targets                   — list Target_Nodes for authenticated user
 *   DELETE /api/v1/targets/:id             — invalidate Node_Identity, set status to revoked
 *   GET  /api/v1/targets/install-manifest  — return InstallManifest JSON
 *
 * Requirement 13: API — Target Enrollment Endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { query } from '../db/client';
import { authenticate } from '../auth';
import { writeAuditEvent } from '../audit';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENROLLMENT_TOKEN_EXPIRY_SECONDS = 600; // 10 minutes

// Service lists per profile (Requirement 6.2, 6.3)
const PROFILE_SERVICES: Record<string, string[]> = {
  core: ['api', 'dashboard', 'neo4j', 'discovery', 'cartography', 'auth'],
  full: ['api', 'dashboard', 'neo4j', 'discovery', 'cartography', 'auth', 'chatbot', 'agents', 'chroma'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a UUID v4 string. */
function generateUUID(): string {
  return crypto.randomUUID();
}

/** Generate an Ed25519 key pair and return PEM-encoded strings. */
function generateEd25519KeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return { privateKey, publicKey };
}

/** Generate a random hex secret of the given byte length. */
function generateSecret(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Return the client IP from the Fastify request. */
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

export async function enrollmentRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /api/v1/targets/enrollment-token ──────────────────────────────────
  // Requirement 13.1, 13.2 — requires valid Bearer token
  app.post(
    '/api/v1/targets/enrollment-token',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';
      const ipAddress = getClientIp(request);

      const token = generateUUID();
      const expiresAt = new Date(Date.now() + ENROLLMENT_TOKEN_EXPIRY_SECONDS * 1000);

      await query(
        `INSERT INTO enrollment_tokens (token, user_id, expires_at)
         VALUES (?, ?, ?)`,
        [token, userId, expiresAt.toISOString()]
      );

      writeAuditEvent(app, 'enrollment_token_issued', userId, ipAddress, 'success', { token });
      return reply.status(201).send({
        enrollment_token: token,
        expires_at: expiresAt.toISOString(),
      });
    }
  );

  // ── POST /api/v1/targets/enroll ────────────────────────────────────────────
  // Requirement 13.3, 13.4, 13.5
  app.post(
    '/api/v1/targets/enroll',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        enrollment_token?: string;
        hostname?: string;
        os?: string;
        architecture?: string;
        ip_address?: string;
        profile?: string;
      };

      const { enrollment_token, hostname, os, architecture, ip_address, profile = 'core' } = body ?? {};
      const ipAddress = getClientIp(request);

      if (!enrollment_token || !hostname || !os || !architecture || !ip_address) {
        return reply.status(400).send({
          error: 'Missing required fields: enrollment_token, hostname, os, architecture, ip_address',
          code: 'missing_fields',
          statusCode: 400,
        });
      }

      // Look up the token
      const tokenResult = await query<{
        token: string;
        user_id: string;
        expires_at: string;
        used: number | boolean;
      }>(
        `SELECT token, user_id, expires_at, used
           FROM enrollment_tokens
          WHERE token = ?`,
        [enrollment_token]
      );

      const tokenRecord = tokenResult.rows[0];

      // Token not found, expired, or already used → 410
      if (!tokenRecord) {
        writeAuditEvent(app, 'target_enrolled', 'unknown', ipAddress, 'failure', { reason: 'token_not_found' });
        return reply.status(410).send({
          error: 'Enrollment token not found, expired, or already used',
          code: 'token_consumed',
          statusCode: 410,
        });
      }

      const now = Date.now();
      const expiresAt = new Date(tokenRecord.expires_at).getTime();
      const isUsed = tokenRecord.used === true || tokenRecord.used === 1;

      if (now > expiresAt || isUsed) {
        writeAuditEvent(app, 'target_enrolled', tokenRecord.user_id, ipAddress, 'failure', { reason: 'token_expired_or_used' });
        return reply.status(410).send({
          error: 'Enrollment token not found, expired, or already used',
          code: 'token_consumed',
          statusCode: 410,
        });
      }

      // Mark token as used (atomic — prevents race conditions)
      const updateResult = await query(
        `UPDATE enrollment_tokens
            SET used = 1
          WHERE token = ?
            AND used = 0
            AND expires_at > ?`,
        [enrollment_token, new Date(now).toISOString()]
      );

      if (updateResult.rowCount === 0) {
        // Another request consumed the token concurrently
        writeAuditEvent(app, 'target_enrolled', tokenRecord.user_id, ipAddress, 'failure', { reason: 'token_consumed_concurrently' });
        return reply.status(410).send({
          error: 'Enrollment token not found, expired, or already used',
          code: 'token_consumed',
          statusCode: 410,
        });
      }

      // Generate Node_Identity
      const targetId = generateUUID();
      const { privateKey, publicKey } = generateEd25519KeyPair();

      // Store the target node (public key only — private key is never stored)
      await query(
        `INSERT INTO managed_targets
           (id, user_id, hostname, os, architecture, ip_address, profile, public_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [targetId, tokenRecord.user_id, hostname, os, architecture, ip_address, profile, publicKey]
      );

      writeAuditEvent(app, 'target_enrolled', tokenRecord.user_id, ipAddress, 'success', { target_id: targetId, hostname });
      return reply.status(201).send({
        target_id: targetId,
        private_key: privateKey,
        public_key: publicKey,
      });
    }
  );

  // ── GET /api/v1/targets ────────────────────────────────────────────────────
  // Requirement 13.6 — list Target_Nodes for authenticated user
  app.get(
    '/api/v1/targets',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';

      const result = await query<{
        id: string;
        hostname: string;
        os: string;
        architecture: string;
        ip_address: string;
        profile: string;
        status: string;
        last_seen: string | null;
        cig_version: string | null;
        created_at: string;
      }>(
        `SELECT id, hostname, os, architecture, ip_address, profile, status,
                last_seen, cig_version, created_at
           FROM managed_targets
          WHERE user_id = ?
          ORDER BY created_at DESC`,
        [userId]
      );

      return reply.send({ items: result.rows, total: result.rowCount });
    }
  );

  // ── DELETE /api/v1/targets/:id ─────────────────────────────────────────────
  // Requirement 13.7 — invalidate Node_Identity, set status to revoked
  app.delete(
    '/api/v1/targets/:id',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';
      const ipAddress = getClientIp(request);

      const result = await query(
        `UPDATE managed_targets
            SET status = 'revoked'
          WHERE id = ?
            AND user_id = ?
            AND status != 'revoked'`,
        [id, userId]
      );

      if (result.rowCount === 0) {
        writeAuditEvent(app, 'target_revoked', userId, ipAddress, 'failure', { target_id: id });
        return reply.status(404).send({
          error: 'Target not found or already revoked',
          code: 'target_not_found',
          statusCode: 404,
        });
      }

      writeAuditEvent(app, 'target_revoked', userId, ipAddress, 'success', { target_id: id });
      return reply.send({ success: true });
    }
  );

  // ── GET /api/v1/targets/install-manifest ──────────────────────────────────
  // Requirement 13.8, 13.9 — return InstallManifest JSON
  app.get(
    '/api/v1/targets/install-manifest',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { target_id, profile = 'core' } = request.query as {
        target_id?: string;
        profile?: string;
      };

      if (!target_id) {
        return reply.status(400).send({
          error: 'Missing required query parameter: target_id',
          code: 'missing_target_id',
          statusCode: 400,
        });
      }

      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';

      // Fetch the target to get its public key
      const targetResult = await query<{
        id: string;
        public_key: string;
        profile: string;
      }>(
        `SELECT id, public_key, profile
           FROM managed_targets
          WHERE id = ?
            AND user_id = ?
            AND status != 'revoked'`,
        [target_id, userId]
      );

      const target = targetResult.rows[0];

      if (!target) {
        return reply.status(404).send({
          error: 'Target not found',
          code: 'target_not_found',
          statusCode: 404,
        });
      }

      const resolvedProfile = (profile === 'full' ? 'full' : 'core') as 'core' | 'full';
      const services = PROFILE_SERVICES[resolvedProfile] ?? PROFILE_SERVICES['core']!;

      // Generate secrets for all services
      const generatedSecrets: Record<string, string> = {};
      for (const svc of services) {
        generatedSecrets[`${svc.toUpperCase()}_SECRET`] = generateSecret();
      }
      generatedSecrets['NEO4J_PASSWORD'] = generateSecret();
      generatedSecrets['JWT_SECRET'] = generateSecret(64);

      const manifest = {
        profile: resolvedProfile,
        services,
        env_overrides: {
          CIG_AUTH_MODE: 'managed',
          CIG_TARGET_ID: target_id,
        },
        node_identity: {
          target_id,
          public_key: target.public_key,
          // private_key is not stored server-side; omitted here (returned only at enrollment)
        },
        generated_secrets: generatedSecrets,
      };

      return reply.send(manifest);
    }
  );
}
