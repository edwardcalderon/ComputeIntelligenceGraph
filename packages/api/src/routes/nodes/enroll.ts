/**
 * Node enrollment API endpoint.
 *
 * Routes:
 *   POST /api/v1/nodes/enroll — validate EnrollmentToken, generate NodeIdentity, return private key once
 *
 * Requirements: 7.1–7.3, 7.10, 3.4, 3.5, 22.4
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { generateNodeIdentity } from '@cig/sdk';
import type { NodeIdentity } from '@cig/sdk';
import { query } from '../../db/client';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

export async function nodeEnrollmentRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /api/v1/nodes/enroll ──────────────────────────────────────────────
  // Requirements: 7.1–7.3, 7.10, 3.4, 3.5, 22.4
  app.post(
    '/api/v1/nodes/enroll',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        enrollmentToken?: string;
        nodeId?: string;
        hostname?: string;
        os?: string;
        architecture?: string;
        ipAddress?: string;
        installProfile?: string;
        mode?: string;
      };

      const {
        enrollmentToken,
        nodeId: providedNodeId,
        hostname,
        os,
        architecture,
        ipAddress,
        installProfile,
        mode,
      } = body ?? {};

      // Validate required fields
      if (!enrollmentToken) {
        return reply.status(400).send({
          error: 'Missing required field: enrollmentToken',
          code: 'missing_enrollment_token',
          statusCode: 400,
        });
      }

      const clientIp = getClientIp(request);

      // ─ Step 1: Validate EnrollmentToken (not expired, not used) ─────────────

      // Find the token record by hashed lookup
      const tokenResult = await query<{
        id: string;
        manifest_id: string;
        token_hash: string;
        used_at: string | null;
        expires_at: string;
      }>(
        `SELECT id, manifest_id, token_hash, used_at, expires_at
           FROM enrollment_token_records
          WHERE expires_at > ?
          LIMIT 100`,
        [new Date().toISOString()]
      );

      // Find matching token by bcrypt comparison
      let tokenRecord: (typeof tokenResult.rows)[0] | undefined;
      for (const row of tokenResult.rows) {
        const matches = await bcrypt.compare(enrollmentToken, row.token_hash);
        if (matches) {
          tokenRecord = row;
          break;
        }
      }

      if (!tokenRecord) {
        await writeOnboardingAuditEvent(
          'system',
          'enrollment-endpoint',
          'enrollment_token_invalid_or_expired',
          'enrollment_token',
          enrollmentToken,
          { clientIp }
        );

        return reply.status(401).send({
          error: 'Enrollment token is invalid or expired',
          code: 'invalid_or_expired_token',
          statusCode: 401,
        });
      }

      // Check if token has already been used
      if (tokenRecord.used_at !== null) {
        await writeOnboardingAuditEvent(
          'system',
          'enrollment-endpoint',
          'enrollment_token_already_used',
          'enrollment_token',
          tokenRecord.id,
          { clientIp }
        );

        return reply.status(401).send({
          error: 'Enrollment token has already been used',
          code: 'token_already_used',
          statusCode: 401,
        });
      }

      // ─ Step 2: Fetch the manifest and intent ───────────────────────────────

      const manifestResult = await query<{
        id: string;
        intent_id: string;
        manifest_payload: string;
      }>(
        `SELECT id, intent_id, manifest_payload
           FROM setup_manifest_records
          WHERE id = ?`,
        [tokenRecord.manifest_id]
      );

      const manifestRecord = manifestResult.rows[0];
      if (!manifestRecord) {
        return reply.status(500).send({
          error: 'Setup manifest record not found',
          code: 'manifest_not_found',
          statusCode: 500,
        });
      }

      const intentResult = await query<{
        id: string;
        user_id: string;
        status: string;
        cloud_provider: string;
        credentials_ref: string;
        install_profile: string;
        target_mode: string;
      }>(
        `SELECT id, user_id, status, cloud_provider, credentials_ref, install_profile, target_mode
           FROM onboarding_intents
          WHERE id = ?`,
        [manifestRecord.intent_id]
      );

      const intent = intentResult.rows[0];
      if (!intent) {
        return reply.status(500).send({
          error: 'Onboarding intent not found',
          code: 'intent_not_found',
          statusCode: 500,
        });
      }

      // ─ Step 3: Generate NodeIdentity (UUID + Ed25519 key pair) ──────────────

      const nodeIdentity = generateNodeIdentity();
      const nodeId = nodeIdentity.nodeId;

      // ─ Step 4: Store public key in NodeIdentityRecord ──────────────────────

      const identityRecordId = crypto.randomUUID();
      const now = new Date();

      await query(
        `INSERT INTO node_identity_records
           (id, node_id, public_key, created_at)
         VALUES (?, ?, ?, ?)`,
        [identityRecordId, nodeId, nodeIdentity.publicKey, now.toISOString()]
      );

      // ─ Step 5: Create ManagedNode record ───────────────────────────────────

      const managedNodeId = crypto.randomUUID();
      await query(
        `INSERT INTO managed_nodes
           (id, user_id, intent_id, hostname, os, architecture, ip_address, install_profile, mode, status, permission_tier, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'enrolling', 1, ?)`,
        [
          nodeId, // Use nodeId as the managed_nodes.id
          intent.user_id,
          intent.id,
          hostname ?? 'unknown',
          os ?? 'unknown',
          architecture ?? 'unknown',
          ipAddress ?? clientIp,
          installProfile ?? intent.install_profile,
          mode ?? 'managed',
          now.toISOString(),
        ]
      );

      // ─ Step 6: Mark token as used ──────────────────────────────────────────

      await query(
        `UPDATE enrollment_token_records
            SET used_at = ?
          WHERE id = ?`,
        [now.toISOString(), tokenRecord.id]
      );

      // ─ Step 7: Transition OnboardingIntent to node_enrolled ────────────────

      await query(
        `UPDATE onboarding_intents
            SET status = 'node_enrolled', updated_at = ?
          WHERE id = ?`,
        [now.toISOString(), intent.id]
      );

      // ─ Step 8: Record InstallationEvent ────────────────────────────────────

      const eventId = crypto.randomUUID();
      await query(
        `INSERT INTO installation_events
           (id, node_id, event_type, payload, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          eventId,
          nodeId,
          'node_enrolled',
          JSON.stringify({
            intentId: intent.id,
            cloudProvider: intent.cloud_provider,
            credentialsRef: intent.credentials_ref,
            installProfile: intent.install_profile,
            targetMode: intent.target_mode,
          }),
          now.toISOString(),
        ]
      );

      // ─ Step 9: Write audit event ───────────────────────────────────────────

      await writeOnboardingAuditEvent(
        'system',
        'enrollment-endpoint',
        'node_enrolled',
        'managed_node',
        nodeId,
        {
          intentId: intent.id,
          userId: intent.user_id,
          cloudProvider: intent.cloud_provider,
          clientIp,
        }
      );

      // ─ Step 10: Return NodeIdentity (private key exactly once) ──────────────

      return reply.status(201).send({
        nodeId: nodeIdentity.nodeId,
        privateKey: nodeIdentity.privateKey,
        publicKey: nodeIdentity.publicKey,
        issuedAt: nodeIdentity.issuedAt,
      } as NodeIdentity);
    }
  );
}
