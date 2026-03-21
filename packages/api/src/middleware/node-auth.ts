/**
 * Node authentication middleware — Ed25519 signature verification.
 *
 * Reads the `X-CIG-Signature` header (base64-encoded Ed25519 signature),
 * looks up the target's public key from `managed_targets`, verifies the
 * signature against the raw request body, and attaches the target record
 * to the request on success.
 *
 * Requirement 14.1, 14.2, 14.4 — heartbeat signature verification
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { query } from '../db/client';
import { writeAuditEvent } from '../audit';

// Extend FastifyRequest to carry the verified target
declare module 'fastify' {
  interface FastifyRequest {
    target?: {
      id: string;
      user_id: string;
      public_key: string;
      status: string;
    };
  }
}

/**
 * Verify an Ed25519 signature.
 *
 * @param body      Raw request body bytes
 * @param signature Base64-encoded signature from X-CIG-Signature header
 * @param publicKey PEM-encoded Ed25519 public key
 * @returns true if the signature is valid
 */
export function verifyEd25519Signature(
  body: Buffer,
  signature: string,
  publicKey: string
): boolean {
  try {
    const sigBuffer = Buffer.from(signature, 'base64');
    return crypto.verify(null, body, publicKey, sigBuffer);
  } catch {
    return false;
  }
}

/**
 * Fastify preHandler middleware that verifies the Ed25519 signature on
 * heartbeat requests.
 *
 * Expects:
 *   - `request.params.id` — the target_id
 *   - `X-CIG-Signature` header — base64-encoded Ed25519 signature of the body
 *
 * On success: attaches `request.target` with the target record.
 * On failure: replies 401 with `invalid_signature`.
 */
export async function verifyNodeSignature(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  const signatureHeader = request.headers['x-cig-signature'];
  const ipAddress = getClientIp(request);
  const app = request.server as FastifyInstance;

  if (!signatureHeader || typeof signatureHeader !== 'string') {
    writeAuditEvent(app, 'heartbeat_signature_failure', id, ipAddress, 'failure', { reason: 'missing_header' });
    return reply.status(401).send({
      error: 'Missing X-CIG-Signature header',
      code: 'invalid_signature',
      statusCode: 401,
    });
  }

  // Look up the target's public key
  const result = await query<{
    id: string;
    user_id: string;
    public_key: string;
    status: string;
  }>(
    `SELECT id, user_id, public_key, status
       FROM managed_targets
      WHERE id = ?
        AND status != 'revoked'`,
    [id]
  );

  const target = result.rows[0];

  if (!target) {
    writeAuditEvent(app, 'heartbeat_signature_failure', id, ipAddress, 'failure', { reason: 'target_not_found' });
    return reply.status(401).send({
      error: 'Target not found or revoked',
      code: 'invalid_signature',
      statusCode: 401,
    });
  }

  // Get raw body bytes — Fastify stores the raw body as a Buffer when
  // addContentTypeParser / rawBody is configured; fall back to JSON serialisation.
  const rawBody: Buffer =
    (request as unknown as { rawBody?: Buffer }).rawBody ??
    Buffer.from(JSON.stringify(request.body) ?? '');

  const valid = verifyEd25519Signature(rawBody, signatureHeader, target.public_key);

  if (!valid) {
    writeAuditEvent(app, 'heartbeat_signature_failure', id, ipAddress, 'failure', { reason: 'invalid_signature' });
    return reply.status(401).send({
      error: 'Invalid Ed25519 signature',
      code: 'invalid_signature',
      statusCode: 401,
    });
  }

  request.target = target;
}

/** Return the client IP from the Fastify request. */
function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() ?? request.ip;
  }
  return request.ip;
}
