/**
 * Bootstrap endpoints for self-hosted installations.
 *
 * Routes:
 *   GET  /api/v1/bootstrap/status    — returns { requires_bootstrap: boolean, mode: "managed" | "self-hosted" }
 *   POST /api/v1/bootstrap/validate  — accepts { bootstrap_token }, returns { valid: true } or 401
 *   POST /api/v1/bootstrap/complete  — accepts { bootstrap_token, username, email, password }
 *
 * Requirement 15: API — Bootstrap Endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db/client';
import { generateJwt, Permission } from '../auth';
import { writeAuditEvent } from '../audit';
import { getAuthMode, hasAdminAccounts } from '../bootstrap/state';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 12;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the client IP from the Fastify request. */
function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() ?? request.ip;
  }
  return request.ip;
}

/** Returns true when the request originates from localhost. */
function isLocalhost(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

// ---------------------------------------------------------------------------
// Localhost-only guard (Task 8.2)
// ---------------------------------------------------------------------------

/**
 * Fastify preHandler that rejects non-localhost requests when
 * CIG_AUTH_MODE=self-hosted.
 */
async function localhostGuard(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (process.env['CIG_AUTH_MODE'] !== 'self-hosted') {
    return; // Guard only applies in self-hosted mode
  }

  const ip = getClientIp(request);
  if (!isLocalhost(ip)) {
    reply.status(403).send({
      error: 'Bootstrap endpoints are only accessible from localhost in self-hosted mode',
      code: 'forbidden_origin',
      statusCode: 403,
    });
  }
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function bootstrapRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/bootstrap/status ───────────────────────────────────────────
  // Requirement 15.1 — returns { requires_bootstrap: boolean, mode: "managed" | "self-hosted" }
  app.get(
    '/api/v1/bootstrap/status',
    { preHandler: [localhostGuard] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const mode = getAuthMode();
      return reply.send({
        requires_bootstrap: mode === 'self-hosted' && !(await hasAdminAccounts()),
        mode,
      });
    }
  );

  // ── POST /api/v1/bootstrap/validate ────────────────────────────────────────
  // Requirement 15.2 — accepts { bootstrap_token }, returns { valid: true } or 401
  app.post(
    '/api/v1/bootstrap/validate',
    { preHandler: [localhostGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { bootstrap_token?: string };
      const token = body?.bootstrap_token;

      if (!token) {
        return reply.status(400).send({
          error: 'Missing required field: bootstrap_token',
          code: 'missing_bootstrap_token',
          statusCode: 400,
        });
      }

      if (await hasAdminAccounts()) {
        return reply.status(409).send({
          error: 'Bootstrap has already been completed',
          code: 'bootstrap_already_complete',
          statusCode: 409,
        });
      }

      const result = await query<{
        token: string;
        expires_at: string;
        consumed: number | boolean;
      }>(
        `SELECT token, expires_at, consumed FROM bootstrap_tokens WHERE token = ?`,
        [token]
      );

      const record = result.rows[0];

      if (!record) {
        return reply.status(401).send({
          error: 'Invalid bootstrap token',
          code: 'bootstrap_token_invalid',
          statusCode: 401,
        });
      }

      const consumed = record.consumed === 1 || record.consumed === true;
      if (consumed) {
        return reply.status(409).send({
          error: 'Bootstrap has already been completed',
          code: 'bootstrap_already_complete',
          statusCode: 409,
        });
      }

      if (new Date(record.expires_at).getTime() < Date.now()) {
        return reply.status(401).send({
          error: 'Bootstrap token has expired',
          code: 'bootstrap_token_expired',
          statusCode: 401,
        });
      }

      return reply.send({ valid: true });
    }
  );

  // ── POST /api/v1/bootstrap/complete ────────────────────────────────────────
  // Requirement 15.3–15.8
  app.post(
    '/api/v1/bootstrap/complete',
    { preHandler: [localhostGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        bootstrap_token?: string;
        username?: string;
        email?: string;
        password?: string;
      };

      const { bootstrap_token, username, email, password } = body ?? {};
      const ipAddress = getClientIp(request);

      // Requirement 15.7 — password length check takes priority over missing-field check
      // so that any password < 12 chars always returns 422 (even if other fields are absent)
      if (typeof password === 'string' && password.length < MIN_PASSWORD_LENGTH) {
        return reply.status(422).send({
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          code: 'password_too_short',
          statusCode: 422,
        });
      }

      // Validate remaining required fields
      if (!bootstrap_token || !username || !email || !password) {
        return reply.status(400).send({
          error: 'Missing required fields: bootstrap_token, username, email, password',
          code: 'missing_fields',
          statusCode: 400,
        });
      }

      if (await hasAdminAccounts()) {
        return reply.status(409).send({
          error: 'Bootstrap has already been completed',
          code: 'bootstrap_already_complete',
          statusCode: 409,
        });
      }

      // Look up the bootstrap token
      const tokenResult = await query<{
        token: string;
        expires_at: string;
        consumed: number | boolean;
      }>(
        `SELECT token, expires_at, consumed FROM bootstrap_tokens WHERE token = ?`,
        [bootstrap_token]
      );

      const record = tokenResult.rows[0];

      if (!record) {
        return reply.status(401).send({
          error: 'Invalid bootstrap token',
          code: 'bootstrap_token_invalid',
          statusCode: 401,
        });
      }

      // Requirement 15.5 — token already consumed → 409
      const consumed = record.consumed === 1 || record.consumed === true;
      if (consumed) {
        return reply.status(409).send({
          error: 'Bootstrap has already been completed',
          code: 'bootstrap_already_complete',
          statusCode: 409,
        });
      }

      // Requirement 15.6 — token expired → 401
      if (new Date(record.expires_at).getTime() < Date.now()) {
        return reply.status(401).send({
          error: 'Bootstrap token has expired',
          code: 'bootstrap_token_expired',
          statusCode: 401,
        });
      }

      // Hash the password
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const adminId = crypto.randomUUID();

      // Create admin account
      await query(
        `INSERT INTO admin_accounts (id, username, email, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [adminId, username, email, passwordHash, new Date().toISOString()]
      );

      // Invalidate the bootstrap token (Requirement 15.4)
      await query(
        `UPDATE bootstrap_tokens SET consumed = 1 WHERE token = ?`,
        [bootstrap_token]
      );

      // Issue session tokens
      const accessToken = generateJwt({
        sub: adminId,
        permissions: [Permission.ADMIN],
      });
      const refreshToken = crypto.randomBytes(32).toString('hex');

      // Requirement 15.8 — write audit event bootstrap_complete
      writeAuditEvent(app, 'bootstrap_complete', adminId, ipAddress, 'success', {
        email,
        username,
      });

      return reply.status(201).send({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }
  );
}
