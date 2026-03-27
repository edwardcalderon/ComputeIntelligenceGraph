/**
 * Identity separation middleware for CIG Node Onboarding.
 *
 * Three strictly separated identity planes (Requirements 14.1–14.10):
 *   - requireHumanAuth    — Authentik JWT / local JWT (human-facing endpoints)
 *   - requireNodeAuth     — Ed25519 X-Node-Signature header (node-facing endpoints)
 *   - requireBootstrapToken — one-time Bootstrap_Token in request body
 *
 * Each middleware rejects the other identity types with 401 and logs all
 * identity plane crossings as OnboardingAuditEvent records.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { verifyBearerToken } from '../auth';
import { query } from '../db/client';
import type { NodeIdentityRecord, BootstrapTokenRecord } from '../db/schema';

// ---------------------------------------------------------------------------
// Fastify request augmentation
// ---------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyRequest {
    /** Populated by requireNodeAuth on success */
    nodeId?: string;
    /** Populated by requireBootstrapToken on success */
    bootstrapToken?: BootstrapTokenRecord;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() ?? request.ip;
  }
  return request.ip;
}

/**
 * Write an OnboardingAuditEvent (fire-and-forget).
 * Never throws — failures are swallowed to avoid blocking the response.
 */
function writeOnboardingAuditEvent(
  request: FastifyRequest,
  actorType: 'human' | 'node' | 'system',
  actorId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown>
): void {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  query(
    `INSERT INTO onboarding_audit_events
       (id, actor_type, actor_id, action, resource_type, resource_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, actorType, actorId, action, resourceType, resourceId, JSON.stringify(metadata), now]
  ).catch((err: unknown) => {
    request.server.log.error({ err, action, actorId }, 'Failed to write onboarding audit event');
  });
}

/**
 * Verify an Ed25519 signature.
 * Public key is base64-encoded DER/SPKI (as stored by generateNodeIdentity).
 */
function verifyEd25519(payload: Buffer, signatureB64: string, publicKeyB64: string): boolean {
  try {
    const keyBuffer = Buffer.from(publicKeyB64, 'base64');
    const keyObject = crypto.createPublicKey({ key: keyBuffer, format: 'der', type: 'spki' });
    return crypto.verify(null, payload, keyObject, Buffer.from(signatureB64, 'base64'));
  } catch {
    return false;
  }
}

function getRawBody(request: FastifyRequest): Buffer {
  return (
    (request as unknown as { rawBody?: Buffer }).rawBody ??
    Buffer.from(JSON.stringify(request.body) ?? '')
  );
}

// ---------------------------------------------------------------------------
// requireHumanAuth
// ---------------------------------------------------------------------------

/**
 * Validates Authentik JWT (or local JWT) from the Authorization Bearer header.
 *
 * Rejects with 401 if:
 *   - X-Node-Signature header is present (node identity plane crossing)
 *   - bootstrap_token field is present in the body (bootstrap identity plane crossing)
 *   - JWT is missing, invalid, or expired
 *
 * Requirements: 14.5, 14.6, 14.7, 14.10
 */
export async function requireHumanAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ip = getClientIp(request);

  // Reject node identity plane crossing
  const nodeSignatureHeader = request.headers['x-node-signature'];
  if (nodeSignatureHeader) {
    const actorId = String(nodeSignatureHeader).split(':')[0] ?? 'unknown';
    writeOnboardingAuditEvent(
      request,
      'node',
      actorId,
      'identity_plane_crossing',
      'endpoint',
      request.url,
      { reason: 'node_signature_on_human_endpoint', ip, url: request.url }
    );
    return reply.status(401).send({
      error: 'Node identity is not accepted on human-facing endpoints',
      code: 'identity_plane_crossing',
      statusCode: 401,
    });
  }

  // Reject bootstrap identity plane crossing
  const body = request.body as Record<string, unknown> | null | undefined;
  if (body && typeof body === 'object' && 'bootstrap_token' in body) {
    writeOnboardingAuditEvent(
      request,
      'system',
      'bootstrap',
      'identity_plane_crossing',
      'endpoint',
      request.url,
      { reason: 'bootstrap_token_on_human_endpoint', ip, url: request.url }
    );
    return reply.status(401).send({
      error: 'Bootstrap token is not accepted on human-facing endpoints',
      code: 'identity_plane_crossing',
      statusCode: 401,
    });
  }

  // Validate JWT
  const authHeader = request.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: 'Authentication required: Bearer token missing',
      code: 'missing_auth',
      statusCode: 401,
    });
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyBearerToken(token);
    (request as any).user = payload;
  } catch {
    return reply.status(401).send({
      error: 'Invalid or expired JWT token',
      code: 'invalid_token',
      statusCode: 401,
    });
  }
}

// ---------------------------------------------------------------------------
// requireNodeAuth
// ---------------------------------------------------------------------------

/**
 * Validates Ed25519 signature from the X-Node-Signature header.
 *
 * Header format: `<nodeId>:<base64-signature>`
 * Signature is computed over the raw request body.
 *
 * Rejects with 401 if:
 *   - Authorization Bearer header is present (human identity plane crossing)
 *   - X-Node-Signature header is missing or malformed
 *   - Node not found or revoked
 *   - Signature is invalid
 *
 * On success: attaches `request.nodeId` for downstream handlers.
 *
 * Requirements: 14.3, 14.5, 14.6, 14.7, 14.10
 */
export async function requireNodeAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ip = getClientIp(request);

  // Reject human identity plane crossing
  const authHeader = request.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    writeOnboardingAuditEvent(
      request,
      'human',
      'unknown',
      'identity_plane_crossing',
      'endpoint',
      request.url,
      { reason: 'bearer_token_on_node_endpoint', ip, url: request.url }
    );
    return reply.status(401).send({
      error: 'Human identity is not accepted on node-facing endpoints',
      code: 'identity_plane_crossing',
      statusCode: 401,
    });
  }

  // Parse X-Node-Signature header
  const signatureHeader = request.headers['x-node-signature'];
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return reply.status(401).send({
      error: 'Missing X-Node-Signature header',
      code: 'missing_node_signature',
      statusCode: 401,
    });
  }

  const colonIndex = signatureHeader.indexOf(':');
  if (colonIndex === -1) {
    return reply.status(401).send({
      error: 'Malformed X-Node-Signature header: expected <nodeId>:<base64-signature>',
      code: 'malformed_node_signature',
      statusCode: 401,
    });
  }

  const nodeId = signatureHeader.slice(0, colonIndex);
  const signatureB64 = signatureHeader.slice(colonIndex + 1);

  if (!nodeId || !signatureB64) {
    return reply.status(401).send({
      error: 'Malformed X-Node-Signature header: nodeId or signature is empty',
      code: 'malformed_node_signature',
      statusCode: 401,
    });
  }

  // Look up node's public key — must not be revoked
  const result = await query<NodeIdentityRecord>(
    `SELECT id, node_id, public_key, revoked_at, created_at
       FROM node_identity_records
      WHERE node_id = ?
        AND revoked_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [nodeId]
  );

  const identityRecord = result.rows[0];
  if (!identityRecord) {
    writeOnboardingAuditEvent(
      request,
      'node',
      nodeId,
      'node_auth_failure',
      'node',
      nodeId,
      { reason: 'node_not_found_or_revoked', ip, url: request.url }
    );
    return reply.status(401).send({
      error: 'Node not found or revoked',
      code: 'node_not_found',
      statusCode: 401,
    });
  }

  // Verify Ed25519 signature over raw body
  const rawBody = getRawBody(request);
  const valid = verifyEd25519(rawBody, signatureB64, identityRecord.public_key);

  if (!valid) {
    writeOnboardingAuditEvent(
      request,
      'node',
      nodeId,
      'node_auth_failure',
      'node',
      nodeId,
      { reason: 'invalid_signature', ip, url: request.url }
    );
    return reply.status(401).send({
      error: 'Invalid Ed25519 signature',
      code: 'invalid_node_signature',
      statusCode: 401,
    });
  }

  // Attach nodeId for downstream handlers
  request.nodeId = nodeId;
}

// ---------------------------------------------------------------------------
// requireBootstrapToken
// ---------------------------------------------------------------------------

/**
 * Validates Bootstrap_Token from the `bootstrap_token` field in the request body.
 *
 * Rejects with 401 if:
 *   - Authorization Bearer header is present (human identity plane crossing)
 *   - X-Node-Signature header is present (node identity plane crossing)
 *   - bootstrap_token is missing from body
 *   - Token not found, already used, or expired
 *   - bcrypt hash does not match
 *
 * On success: attaches `request.bootstrapToken` for downstream handlers.
 *
 * Requirements: 14.4, 14.8, 14.10
 */
export async function requireBootstrapToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ip = getClientIp(request);

  // Reject human identity plane crossing
  const authHeader = request.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    writeOnboardingAuditEvent(
      request,
      'human',
      'unknown',
      'identity_plane_crossing',
      'endpoint',
      request.url,
      { reason: 'bearer_token_on_bootstrap_endpoint', ip, url: request.url }
    );
    return reply.status(401).send({
      error: 'Human identity is not accepted on the bootstrap endpoint',
      code: 'identity_plane_crossing',
      statusCode: 401,
    });
  }

  // Reject node identity plane crossing
  const nodeSignatureHeader = request.headers['x-node-signature'];
  if (nodeSignatureHeader) {
    const actorId = String(nodeSignatureHeader).split(':')[0] ?? 'unknown';
    writeOnboardingAuditEvent(
      request,
      'node',
      actorId,
      'identity_plane_crossing',
      'endpoint',
      request.url,
      { reason: 'node_signature_on_bootstrap_endpoint', ip, url: request.url }
    );
    return reply.status(401).send({
      error: 'Node identity is not accepted on the bootstrap endpoint',
      code: 'identity_plane_crossing',
      statusCode: 401,
    });
  }

  // Extract bootstrap_token from body
  const body = request.body as Record<string, unknown> | null | undefined;
  const rawToken = body && typeof body === 'object' ? (body['bootstrap_token'] as string | undefined) : undefined;

  if (!rawToken || typeof rawToken !== 'string') {
    return reply.status(401).send({
      error: 'Missing bootstrap_token in request body',
      code: 'missing_bootstrap_token',
      statusCode: 401,
    });
  }

  // Look up token records — find candidates that are not yet used
  const now = new Date();
  const result = await query<BootstrapTokenRecord>(
    `SELECT id, token_hash, first_accessed_at, used_at, expires_at, created_at
       FROM bootstrap_token_records
      WHERE used_at IS NULL
      ORDER BY created_at DESC`,
    []
  );

  // Find a matching record by bcrypt comparison
  let matchedRecord: BootstrapTokenRecord | null = null;
  for (const record of result.rows) {
    // Check expiry first (skip expired records)
    const expiresAt = new Date(record.expires_at);
    if (now > expiresAt) {
      continue;
    }
    const matches = await bcrypt.compare(rawToken, record.token_hash);
    if (matches) {
      matchedRecord = record;
      break;
    }
  }

  if (!matchedRecord) {
    return reply.status(401).send({
      error: 'Invalid, expired, or already used bootstrap token',
      code: 'invalid_bootstrap_token',
      statusCode: 401,
    });
  }

  // Attach token record for downstream handlers
  request.bootstrapToken = matchedRecord;
}
