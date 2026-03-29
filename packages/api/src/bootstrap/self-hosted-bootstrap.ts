import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { FastifyBaseLogger } from 'fastify';
import { query } from '../db/client';
import { getAuthMode, hasAdminAccounts } from './state';

const BOOTSTRAP_TTL_MS = 30 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

type BootstrapLogger = Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>;

async function hasUsableLegacyBootstrapToken(): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await query<{ count: number | string }>(
    `SELECT COUNT(*) AS count
       FROM bootstrap_tokens
      WHERE consumed = 0
        AND expires_at > ?`,
    [now]
  );
  return Number(result.rows[0]?.count ?? 0) > 0;
}

async function hasUsableNodeBootstrapToken(): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await query<{ count: number | string }>(
    `SELECT COUNT(*) AS count
       FROM bootstrap_token_records
      WHERE used_at IS NULL
        AND expires_at > ?`,
    [now]
  );
  return Number(result.rows[0]?.count ?? 0) > 0;
}

async function seedLegacyBootstrapToken(rawToken: string, nowIso: string): Promise<void> {
  const expiresAt = new Date(Date.now() + BOOTSTRAP_TTL_MS).toISOString();
  await query(
    `INSERT INTO bootstrap_tokens (token, expires_at, consumed, created_at)
     VALUES (?, ?, 0, ?)
     ON CONFLICT(token) DO UPDATE SET
       expires_at = excluded.expires_at,
       consumed = excluded.consumed,
       created_at = excluded.created_at`,
    [rawToken, expiresAt, nowIso]
  );
}

async function seedNodeBootstrapToken(rawToken: string, nowIso: string): Promise<void> {
  const expiresAt = new Date(Date.now() + BOOTSTRAP_TTL_MS).toISOString();
  const tokenHash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS);
  const tokenId = crypto.randomUUID();

  await query(
    `INSERT INTO bootstrap_token_records
       (id, token_hash, first_accessed_at, used_at, expires_at, created_at)
     VALUES (?, ?, NULL, NULL, ?, ?)`,
    [tokenId, tokenHash, expiresAt, nowIso]
  );
}

export async function seedSelfHostedBootstrapTokens(
  logger: BootstrapLogger = console
): Promise<void> {
  if (getAuthMode() !== 'self-hosted') {
    return;
  }

  const rawToken = process.env['CIG_BOOTSTRAP_TOKEN']?.trim();
  if (!rawToken) {
    return;
  }

  if (await hasAdminAccounts()) {
    return;
  }

  const nowIso = new Date().toISOString();
  const seededTables: string[] = [];

  if (!(await hasUsableLegacyBootstrapToken())) {
    await seedLegacyBootstrapToken(rawToken, nowIso);
    seededTables.push('bootstrap_tokens');
  }

  if (!(await hasUsableNodeBootstrapToken())) {
    await seedNodeBootstrapToken(rawToken, nowIso);
    seededTables.push('bootstrap_token_records');
  }

  if (seededTables.length > 0) {
    logger.info(
      { seededTables },
      'Seeded self-hosted bootstrap token records from the configured install token'
    );
  }
}
