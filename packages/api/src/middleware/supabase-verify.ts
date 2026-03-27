import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

const SUPABASE_AUTH_PATH = '/auth/v1';

let jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function normalizeOptionalText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function resolveSupabaseBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return normalizeOptionalText(env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL);
}

function resolveSupabaseAuthIssuer(env: NodeJS.ProcessEnv = process.env): string {
  const baseUrl = resolveSupabaseBaseUrl(env);
  if (!baseUrl) {
    throw new Error('SUPABASE_URL is not configured');
  }

  const url = new URL(baseUrl);
  url.pathname = url.pathname.replace(/\/+$/, '');

  if (!url.pathname.endsWith(SUPABASE_AUTH_PATH)) {
    url.pathname = `${url.pathname}${SUPABASE_AUTH_PATH}`;
  }

  return url.toString().replace(/\/+$/, '');
}

function getSupabaseJwks(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  const cached = jwksCache.get(issuer);
  if (cached) {
    return cached;
  }

  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  jwksCache.set(issuer, jwks);
  return jwks;
}

export interface SupabaseVerifiedPayload {
  sub: string;
  email: string;
  role: string;
  appMetadata: Record<string, unknown>;
  [key: string]: unknown;
}

export async function verifySupabaseAccessToken(
  accessToken: string,
): Promise<SupabaseVerifiedPayload> {
  const issuer = resolveSupabaseAuthIssuer();
  const { payload } = await jwtVerify(accessToken, getSupabaseJwks(issuer), { issuer });

  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof (payload as JWTPayload & { email?: string }).email === 'string'
    ? (payload as JWTPayload & { email?: string }).email!
    : '';
  const role = typeof (payload as JWTPayload & { role?: string }).role === 'string'
    ? (payload as JWTPayload & { role?: string }).role!
    : '';
  const appMetadata = isRecord((payload as JWTPayload & { app_metadata?: unknown }).app_metadata)
    ? ((payload as JWTPayload & { app_metadata?: Record<string, unknown> }).app_metadata ?? {})
    : {};

  return { ...payload, sub, email, role, appMetadata };
}

export function resetSupabaseJWKSCache(): void {
  jwksCache = new Map();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
