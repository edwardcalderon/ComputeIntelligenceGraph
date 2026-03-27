/**
 * Onboarding intent and manifest API endpoints.
 *
 * Routes:
 *   POST /api/v1/onboarding/intents              — create OnboardingIntent + SetupManifest
 *   GET  /api/v1/onboarding/intents/:id/manifest — return signed SetupManifest
 *   GET  /api/v1/onboarding/intents/:id/status   — return current OnboardingStatus
 *
 * All routes require Human_Identity auth (Authentik JWT / local JWT).
 * Requirements: 3.1–3.9, 17.1–17.3, 22.1
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { authenticate } from '../auth';
import { query } from '../db/client';
import { signManifest } from '@cig/sdk';
import type { SetupManifest } from '@cig/sdk';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENROLLMENT_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const BCRYPT_ROUNDS = 10;

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

function getSigningKey(): string {
  const key = process.env['MANIFEST_SIGNING_KEY'] ?? process.env['JWT_SECRET'] ?? '';
  if (!key) {
    throw new Error('MANIFEST_SIGNING_KEY (or JWT_SECRET) environment variable is not set');
  }
  return key;
}

function getControlPlaneEndpoint(mode?: string): string {
  // Self-hosted mode always uses the local API endpoint (Requirements 13.9, 13.10)
  if (mode === 'self-hosted') {
    return process.env['SELF_HOSTED_API_URL'] ?? 'http://localhost:3003';
  }
  return (
    process.env['CONTROL_PLANE_URL'] ??
    process.env['NEXT_PUBLIC_API_URL'] ??
    'http://localhost:3003'
  );
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function onboardingRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /api/v1/onboarding/intents ────────────────────────────────────────
  // Requirements: 3.1, 3.2, 3.3, 3.4, 17.1, 22.1
  app.post(
    '/api/v1/onboarding/intents',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';

      const body = request.body as {
        cloudProvider?: string;
        credentialsRef?: string;
        installProfile?: string;
        targetMode?: string;
        mode?: string;
        awsConfig?: Record<string, unknown>;
        gcpConfig?: Record<string, unknown>;
      };

      const { cloudProvider, credentialsRef, installProfile, targetMode, mode, awsConfig, gcpConfig } =
        body ?? {};

      // Validate required fields
      if (!cloudProvider || !credentialsRef || !installProfile || !targetMode) {
        return reply.status(400).send({
          error: 'Missing required fields: cloudProvider, credentialsRef, installProfile, targetMode',
          code: 'missing_fields',
          statusCode: 400,
        });
      }

      if (cloudProvider !== 'aws' && cloudProvider !== 'gcp') {
        return reply.status(400).send({
          error: 'cloudProvider must be "aws" or "gcp"',
          code: 'invalid_cloud_provider',
          statusCode: 400,
        });
      }

      if (installProfile !== 'core' && installProfile !== 'full') {
        return reply.status(400).send({
          error: 'installProfile must be "core" or "full"',
          code: 'invalid_install_profile',
          statusCode: 400,
        });
      }

      if (targetMode !== 'local' && targetMode !== 'ssh' && targetMode !== 'host') {
        return reply.status(400).send({
          error: 'targetMode must be "local", "ssh", or "host"',
          code: 'invalid_target_mode',
          statusCode: 400,
        });
      }

      const intentId = crypto.randomUUID();
      const now = new Date();

      // Create OnboardingIntent (status starts as 'draft')
      await query(
        `INSERT INTO onboarding_intents
           (id, user_id, cloud_provider, credentials_ref, install_profile, target_mode, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
        [intentId, userId, cloudProvider, credentialsRef, installProfile, targetMode,
          now.toISOString(), now.toISOString()]
      );

      // Generate EnrollmentToken: UUID, bcrypt-hashed, 15-min TTL
      const rawToken = crypto.randomUUID();
      const tokenHash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS);
      const tokenId = crypto.randomUUID();
      const tokenExpiresAt = new Date(now.getTime() + ENROLLMENT_TOKEN_TTL_MS);

      // Build and sign SetupManifest
      const issuedAt = now.toISOString();
      const expiresAt = tokenExpiresAt.toISOString();
      const controlPlaneEndpoint = getControlPlaneEndpoint(mode);
      const nodeIdentitySeed = crypto.randomBytes(16).toString('hex');

      const manifestBody: Omit<SetupManifest, 'signature'> = {
        version: '1.0',
        cloudProvider: cloudProvider as 'aws' | 'gcp',
        credentialsRef,
        enrollmentToken: rawToken,
        nodeIdentitySeed,
        installProfile: installProfile as 'core' | 'full',
        targetMode: targetMode as 'local' | 'ssh' | 'host',
        controlPlaneEndpoint,
        issuedAt,
        expiresAt,
        ...(awsConfig ? { awsConfig: awsConfig as unknown as SetupManifest['awsConfig'] } : {}),
        ...(gcpConfig ? { gcpConfig: gcpConfig as unknown as SetupManifest['gcpConfig'] } : {}),
      };

      const signingKey = getSigningKey();
      const signedManifest = signManifest(manifestBody, signingKey);
      const manifestPayload = JSON.stringify(signedManifest);

      // Store SetupManifestRecord
      const manifestId = crypto.randomUUID();
      await query(
        `INSERT INTO setup_manifest_records
           (id, intent_id, manifest_payload, enrollment_token_id, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [manifestId, intentId, manifestPayload, tokenId, expiresAt, now.toISOString()]
      );

      // Store EnrollmentTokenRecord (hashed)
      await query(
        `INSERT INTO enrollment_token_records
           (id, manifest_id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [tokenId, manifestId, tokenHash, expiresAt, now.toISOString()]
      );

      // Transition intent to manifest_ready
      await query(
        `UPDATE onboarding_intents
            SET status = 'manifest_ready', updated_at = ?
          WHERE id = ?`,
        [new Date().toISOString(), intentId]
      );

      const manifestUrl = `${controlPlaneEndpoint}/api/v1/onboarding/intents/${intentId}/manifest`;
      const cliCommand = `cig install --manifest ${manifestUrl}`;

      return reply.status(201).send({
        intentId,
        manifestUrl,
        cliCommand,
      });
    }
  );

  // ── GET /api/v1/onboarding/intents/:id/manifest ────────────────────────────
  // Requirements: 3.7, 17.2
  app.get(
    '/api/v1/onboarding/intents/:id/manifest',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';

      // Verify intent belongs to caller
      const intentResult = await query<{ id: string; user_id: string; status: string }>(
        `SELECT id, user_id, status FROM onboarding_intents WHERE id = ?`,
        [id]
      );

      const intent = intentResult.rows[0];
      if (!intent) {
        return reply.status(404).send({
          error: 'Onboarding intent not found',
          code: 'intent_not_found',
          statusCode: 404,
        });
      }

      if (intent.user_id !== userId) {
        return reply.status(403).send({
          error: 'Access denied: intent does not belong to caller',
          code: 'access_denied',
          statusCode: 403,
        });
      }

      // Fetch the manifest record
      const manifestResult = await query<{
        id: string;
        manifest_payload: string;
        expires_at: string;
      }>(
        `SELECT id, manifest_payload, expires_at
           FROM setup_manifest_records
          WHERE intent_id = ?
          ORDER BY created_at DESC
          LIMIT 1`,
        [id]
      );

      const manifestRecord = manifestResult.rows[0];
      if (!manifestRecord) {
        return reply.status(404).send({
          error: 'Setup manifest not found for this intent',
          code: 'manifest_not_found',
          statusCode: 404,
        });
      }

      // Transition intent to cli_started if it was manifest_ready
      if (intent.status === 'manifest_ready') {
        await query(
          `UPDATE onboarding_intents SET status = 'cli_started', updated_at = ? WHERE id = ?`,
          [new Date().toISOString(), id]
        );
      }

      let parsedManifest: SetupManifest;
      try {
        parsedManifest = JSON.parse(manifestRecord.manifest_payload) as SetupManifest;
      } catch {
        return reply.status(500).send({
          error: 'Failed to parse stored manifest',
          code: 'manifest_parse_error',
          statusCode: 500,
        });
      }

      return reply.send(parsedManifest);
    }
  );

  // ── GET /api/v1/onboarding/intents/:id/status ──────────────────────────────
  // Requirements: 3.9, 17.3
  app.get(
    '/api/v1/onboarding/intents/:id/status',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';

      const intentResult = await query<{
        id: string;
        user_id: string;
        status: string;
        cloud_provider: string;
        updated_at: string;
      }>(
        `SELECT id, user_id, status, cloud_provider, updated_at
           FROM onboarding_intents
          WHERE id = ?`,
        [id]
      );

      const intent = intentResult.rows[0];
      if (!intent) {
        return reply.status(404).send({
          error: 'Onboarding intent not found',
          code: 'intent_not_found',
          statusCode: 404,
        });
      }

      if (intent.user_id !== userId) {
        return reply.status(403).send({
          error: 'Access denied: intent does not belong to caller',
          code: 'access_denied',
          statusCode: 403,
        });
      }

      return reply.send({
        intentId: intent.id,
        status: intent.status,
        cloudProvider: intent.cloud_provider,
        updatedAt: intent.updated_at,
      });
    }
  );
}
