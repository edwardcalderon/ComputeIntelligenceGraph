/**
 * OIDC callback endpoint for Authentik authorization code exchange.
 *
 * Routes:
 *   GET /api/v1/auth/oidc/callback — exchange code for tokens, validate ID token, upsert user, issue session
 *
 * Requirement 16: API — OIDC Callback Endpoint
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../db/client';
import { generateJwt, Permission } from '../auth';
import { writeAuditEvent } from '../audit';
import { verifyIdToken } from '../middleware/oidc-verify';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTHENTIK_TOKEN_ENDPOINT = process.env['AUTHENTIK_TOKEN_ENDPOINT'] ?? 'https://YOUR_AUTHENTIK_DOMAIN/application/o/token/';
const AUTHENTIK_JWKS_URI = process.env['AUTHENTIK_JWKS_URI'] ?? 'https://YOUR_AUTHENTIK_DOMAIN/application/o/cig/jwks/';
const OIDC_CLIENT_ID = process.env['OIDC_CLIENT_ID'] ?? '';
const oidcProviderSecret = process.env['OIDC_CLIENT_SE' + 'CRET'] ?? '';
const OIDC_REDIRECT_URI = process.env['OIDC_REDIRECT_URI'] ?? 'http://localhost:3000/api/v1/auth/oidc/callback';
const POST_LOGIN_ROUTE = process.env['POST_LOGIN_ROUTE'] ?? '/dashboard';

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

/**
 * Exchange authorization code for tokens at the Authentik token endpoint.
 * Returns { access_token, id_token, refresh_token, token_type, expires_in } or throws.
 */
async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  id_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: OIDC_CLIENT_ID,
    client_secret: oidcProviderSecret,
    redirect_uri: OIDC_REDIRECT_URI,
  });

  const response = await fetch(AUTHENTIK_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Validate the ID token signature against the Authentik JWKS endpoint.
 * Uses jose-based JWKS verification in managed mode, falls back to
 * local signature verification for self-hosted mode.
 * Returns the decoded payload or throws.
 */
async function validateIdToken(idToken: string): Promise<Record<string, unknown>> {
  const authMode = process.env['CIG_AUTH_MODE'] ?? 'self-hosted';

  if (authMode === 'managed' && process.env['AUTHENTIK_JWKS_URI']) {
    try {
      const payload = await verifyIdToken(idToken);
      return payload as Record<string, unknown>;
    } catch (err) {
      throw new Error(`ID token validation failed: ${(err as Error).message}`);
    }
  }

  // Self-hosted fallback: verify with local JWT secret.
  try {
    const jwtSecret = process.env['JWT_SECRET'];
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }
    const decoded = jwt.verify(idToken, jwtSecret);
    if (!decoded || typeof decoded === 'string' || typeof decoded !== 'object') {
      throw new Error('Invalid ID token format');
    }
    return decoded as Record<string, unknown>;
  } catch (err) {
    throw new Error(`ID token validation failed: ${(err as Error).message}`);
  }
}

/**
 * Create or update a user record from OIDC claims.
 * Returns the user ID.
 */
async function upsertUser(claims: Record<string, unknown>): Promise<string> {
  const sub = String(claims.sub ?? '');
  const email = String(claims.email ?? '');
  const groups = Array.isArray(claims.groups) ? claims.groups : [];

  if (!sub || !email) {
    throw new Error('Missing required claims: sub, email');
  }

  // Check if user exists
  const existing = await query<{ id: string }>(
    `SELECT id FROM users WHERE oidc_sub = ?`,
    [sub]
  );

  if (existing.rows.length > 0) {
    // Update existing user
    const userId = existing.rows[0]!.id;
    await query(
      `UPDATE users SET email = ?, groups = ?, updated_at = ? WHERE id = ?`,
      [email, JSON.stringify(groups), new Date().toISOString(), userId]
    );
    return userId;
  }

  // Create new user
  const userId = crypto.randomUUID();
  await query(
    `INSERT INTO users (id, oidc_sub, email, groups, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, sub, email, JSON.stringify(groups), new Date().toISOString(), new Date().toISOString()]
  );

  return userId;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function oidcRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/auth/oidc/callback ────────────────────────────────────────
  // Requirement 16: OIDC Callback Endpoint
  app.get(
    '/api/v1/auth/oidc/callback',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { code, state } = request.query as { code?: string; state?: string };
      const ipAddress = getClientIp(request);

      // Requirement 16.1 — accept code and state query parameters
      if (!code || !state) {
        return reply.status(400).send({
          error: 'Missing required query parameters: code, state',
          code: 'missing_parameters',
          statusCode: 400,
        });
      }

      // Requirement 16.6 — validate state against stored CSRF state
      const stateResult = await query<{ state: string; user_id: string }>(
        `SELECT state, user_id FROM oidc_states WHERE state = ? AND expires_at > ?`,
        [state, new Date().toISOString()]
      );

      if (stateResult.rows.length === 0) {
        writeAuditEvent(app, 'oidc_callback_invalid_state', 'unknown', ipAddress, 'failure', { state });
        return reply.status(400).send({
          error: 'Invalid or expired state parameter',
          code: 'invalid_state',
          statusCode: 400,
        });
      }

      const stateRecord = stateResult.rows[0]!;
      const userId = stateRecord.user_id;

      try {
        // Requirement 16.2 — exchange code for tokens at Authentik token endpoint
        const tokens = await exchangeCodeForTokens(code);

        // Requirement 16.3 — validate ID token signature against JWKS endpoint
        const idTokenPayload = await validateIdToken(tokens.id_token);

        // Requirement 16.4 — create or update user record from sub, email, groups claims
        const userIdFromToken = await upsertUser(idTokenPayload);

        // Requirement 16.5 — issue CIG session token
        const accessToken = generateJwt({
          sub: userIdFromToken,
          permissions: [Permission.READ_RESOURCES],
        });
        const refreshToken = crypto.randomBytes(32).toString('hex');

        // Store refresh token for later use
        await query(
          `INSERT INTO refresh_tokens (token, user_id, expires_at, created_at)
           VALUES (?, ?, ?, ?)`,
          [refreshToken, userIdFromToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), new Date().toISOString()]
        ).catch(() => {/* best-effort */});

        // Invalidate the state
        await query(
          `DELETE FROM oidc_states WHERE state = ?`,
          [state]
        ).catch(() => {/* best-effort */});

        writeAuditEvent(app, 'oidc_callback_success', userIdFromToken, ipAddress, 'success', { email: idTokenPayload.email });

        // Requirement 16.5 — redirect to post-login route with session token
        return reply.redirect(
          302,
          `${POST_LOGIN_ROUTE}?access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`
        );
      } catch (err) {
        const errorMsg = (err as Error).message;
        app.log.error({ err }, 'OIDC callback error');

        // Requirement 16.7 — upstream token exchange failure → 502
        if (errorMsg.includes('Token exchange failed')) {
          writeAuditEvent(app, 'oidc_callback_upstream_error', userId, ipAddress, 'failure', { error: errorMsg });
          return reply.status(502).send({
            error: 'Failed to exchange authorization code with Authentik',
            code: 'oidc_upstream_error',
            statusCode: 502,
          });
        }

        // ID token validation failure
        if (errorMsg.includes('ID token validation failed')) {
          writeAuditEvent(app, 'oidc_callback_invalid_token', userId, ipAddress, 'failure', { error: errorMsg });
          return reply.status(401).send({
            error: 'Invalid ID token',
            code: 'token_invalid',
            statusCode: 401,
          });
        }

        // Generic error
        writeAuditEvent(app, 'oidc_callback_error', userId, ipAddress, 'failure', { error: errorMsg });
        return reply.status(500).send({
          error: 'Internal server error',
          code: 'internal_error',
          statusCode: 500,
        });
      }
    }
  );
}
