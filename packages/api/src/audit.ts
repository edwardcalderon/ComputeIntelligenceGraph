/**
 * Audit logging module.
 *
 * Provides a non-blocking, fire-and-forget audit event writer.
 * Failures are logged but never propagate to the caller.
 *
 * Requirement 18: Audit Logging
 */

import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { query } from './db/client';

/**
 * Write an audit event asynchronously (fire-and-forget).
 *
 * This function never throws or blocks the caller. If the write fails,
 * the error is logged to the application logger and execution continues.
 *
 * @param app - Fastify instance (for logging)
 * @param eventType - Type of event (e.g., 'device_authorize_initiated', 'bootstrap_complete')
 * @param actor - User ID or target ID performing the action
 * @param ipAddress - Client IP address
 * @param outcome - 'success' or 'failure'
 * @param metadata - Optional additional context (stored as JSONB)
 */
export function writeAuditEvent(
  app: FastifyInstance,
  eventType: string,
  actor: string,
  ipAddress: string,
  outcome: 'success' | 'failure',
  metadata?: Record<string, unknown>
): void {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // Fire-and-forget: do not await, do not throw
  query(
    `INSERT INTO audit_events (id, event_type, actor, ip_address, outcome, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      eventType,
      actor,
      ipAddress,
      outcome,
      metadata ? JSON.stringify(metadata) : null,
      createdAt,
    ]
  ).catch((err: unknown) => {
    // Log the failure but do not propagate
    app.log.error({ err, eventType, actor }, 'Failed to write audit event');
  });
}
