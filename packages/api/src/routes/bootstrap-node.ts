/**
 * CIG Node Onboarding — Self-Hosted Bootstrap API Endpoints
 *
 * Routes:
 *   GET  /api/v1/bootstrap/node/status   — { requires_bootstrap: boolean, mode: "managed" | "self-hosted" }
 *   POST /api/v1/bootstrap/node/init     — localhost-only; generate BootstrapTokenRecord (bcrypt-hashed, 30-min TTL)
 *   POST /api/v1/bootstrap/node/complete — requireBootstrapToken; create admin account, invalidate token, return session
 *
 * No Authentik dependency — local API handles admin account creation and session management.
 *
 * Requirements: 13.4–13.7, 17.10–17.12
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db/client';
import { generateJwt, Permission } from '../auth';
import { requireBootstrapToken } from '../middleware/auth';
import { getAuthMode, hasAdminAccounts } from '../bootstrap/state';
import { isLocalBootstrapRequest } from '../bootstrap/request-context';
import type { BootstrapTokenRecord } from '../db/schema';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 12;
const BOOTSTRAP_TTL_MS = 30 * 60 * 1000; // 30 minutes from first Dashboard access

/** localhost-only guard for the init endpoint */
async function localhostOnly(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!isLocalBootstrapRequest(request)) {
    return reply.status(403).send({
      error: 'This endpoint is only accessible from localhost',
      code: 'forbidden_origin',
      statusCode: 403,
    });
  }
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function bootstrapNodeRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/bootstrap/node/status ──────────────────────────────────────
  // Returns { requires_bootstrap: boolean, mode } based on whether any admin accounts exist.
  // No auth required — called by Dashboard on first access.
  // Requirements: 13.4, 17.10
  app.get(
    '/api/v1/bootstrap/node/status',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const mode = getAuthMode();
      return reply.send({
        requires_bootstrap: mode === 'self-hosted' && !(await hasAdminAccounts()),
        mode,
      });
    }
  );

  // ── POST /api/v1/bootstrap/node/init ───────────────────────────────────────
  // localhost-only, no auth.
  // Generates a BootstrapTokenRecord (bcrypt-hashed, 30-min TTL from first Dashboard access).
  // The TTL clock starts when the Dashboard first calls /status and sees bootstrapRequired=true.
  // Requirements: 13.5, 17.11
  app.post(
    '/api/v1/bootstrap/node/init',
    { preHandler: [localhostOnly] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      // Check if bootstrap is still required
      if (await hasAdminAccounts()) {
        return reply.status(409).send({
          error: 'Bootstrap already completed — admin accounts exist',
          code: 'bootstrap_already_complete',
          statusCode: 409,
        });
      }

      // Generate a 32-char cryptographically random token
      const rawToken = crypto.randomBytes(16).toString('hex');
      const tokenHash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS);
      const tokenId = crypto.randomUUID();
      const now = new Date();
      // TTL is 30 min from first Dashboard access; we set a generous initial expiry
      // that will be tightened when first_accessed_at is set.
      const expiresAt = new Date(now.getTime() + BOOTSTRAP_TTL_MS);

      await query(
        `INSERT INTO bootstrap_token_records
           (id, token_hash, first_accessed_at, used_at, expires_at, created_at)
         VALUES (?, ?, NULL, NULL, ?, ?)`,
        [tokenId, tokenHash, expiresAt.toISOString(), now.toISOString()]
      );

      return reply.status(201).send({
        token: rawToken,
        expiresAt: expiresAt.toISOString(),
        message: 'Bootstrap token generated. Display this token to the operator — it will not be shown again.',
      });
    }
  );

  // ── POST /api/v1/bootstrap/node/complete ───────────────────────────────────
  // requireBootstrapToken validates the token from bootstrap_token_records.
  // Creates admin account, invalidates token, returns session.
  // Requirements: 13.6, 13.7, 17.12
  app.post(
    '/api/v1/bootstrap/node/complete',
    { preHandler: [requireBootstrapToken] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        bootstrap_token?: string;
        username?: string;
        email?: string;
        password?: string;
      };

      const { username, email, password } = body ?? {};

      if (await hasAdminAccounts()) {
        return reply.status(409).send({
          error: 'Bootstrap already completed — admin accounts exist',
          code: 'bootstrap_already_complete',
          statusCode: 409,
        });
      }

      // Password length check first (consistent with existing bootstrap route)
      if (typeof password === 'string' && password.length < MIN_PASSWORD_LENGTH) {
        return reply.status(422).send({
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          code: 'password_too_short',
          statusCode: 422,
        });
      }

      if (!username || !email || !password) {
        return reply.status(400).send({
          error: 'Missing required fields: username, email, password',
          code: 'missing_fields',
          statusCode: 400,
        });
      }

      // The token record was validated and attached by requireBootstrapToken
      const tokenRecord = request.bootstrapToken as BootstrapTokenRecord;

      // Update first_accessed_at if not set (start the 30-min TTL clock)
      if (!tokenRecord.first_accessed_at) {
        const newExpiry = new Date(Date.now() + BOOTSTRAP_TTL_MS);
        await query(
          `UPDATE bootstrap_token_records
              SET first_accessed_at = ?, expires_at = ?
            WHERE id = ?`,
          [new Date().toISOString(), newExpiry.toISOString(), tokenRecord.id]
        );
      }

      // Hash password and create admin account
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const adminId = crypto.randomUUID();

      await query(
        `INSERT INTO admin_accounts (id, username, email, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [adminId, username, email, passwordHash, new Date().toISOString()]
      );

      // Invalidate the bootstrap token (Requirements 13.6, 13.7)
      await query(
        `UPDATE bootstrap_token_records SET used_at = ? WHERE id = ?`,
        [new Date().toISOString(), tokenRecord.id]
      );

      // Issue session JWT
      const accessToken = generateJwt({
        sub: adminId,
        permissions: [Permission.ADMIN],
      });

      return reply.status(201).send({
        access_token: accessToken,
        adminId,
        message: 'Bootstrap complete. Admin account created.',
      });
    }
  );
}
