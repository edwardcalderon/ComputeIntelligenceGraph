import { query } from '../db/client';

export type AuthMode = 'managed' | 'self-hosted';

export function getAuthMode(): AuthMode {
  return process.env['CIG_AUTH_MODE'] === 'managed' ? 'managed' : 'self-hosted';
}

export async function hasAdminAccounts(): Promise<boolean> {
  const result = await query<{ count: number | string }>(
    `SELECT COUNT(*) AS count FROM admin_accounts`
  );
  return Number(result.rows[0]?.count ?? 0) > 0;
}
