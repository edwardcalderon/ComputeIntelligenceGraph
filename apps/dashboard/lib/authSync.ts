import { createClient } from "@supabase/supabase-js";

const DEFAULT_AUTHENTIK_ISSUER = "https://auth.cig.technology";
const ADMIN_PAGE_SIZE = 200;

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

interface SupabaseAuthUser {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
}

interface SupabaseAdminError {
  message?: string;
}

interface SupabaseAdminClient {
  rpc(
    fn: string,
    params: Record<string, unknown>,
  ): Promise<{ error: SupabaseAdminError | null }>;
  auth: {
    admin: {
      listUsers(params?: {
        page?: number;
        perPage?: number;
      }): Promise<{
        data: {
          users: SupabaseAuthUser[];
          nextPage?: number | null;
          lastPage?: number;
          total?: number;
        };
        error: SupabaseAdminError | null;
      }>;
      createUser(attributes: Record<string, unknown>): Promise<{
        data: { user: SupabaseAuthUser | null };
        error: SupabaseAdminError | null;
      }>;
      updateUserById(uid: string, attributes: Record<string, unknown>): Promise<{
        data: { user: SupabaseAuthUser | null };
        error: SupabaseAdminError | null;
      }>;
      deleteUser(uid: string): Promise<{
        data: { user: SupabaseAuthUser | null };
        error: SupabaseAdminError | null;
      }>;
    };
  };
}

export interface OidcSyncPayload {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  provider?: string;
  iss?: string;
  emailVerified?: boolean;
  rawClaims?: Record<string, JsonValue>;
}

export interface SupabaseAdminConfig {
  url: string;
  serviceRoleKey: string;
}

export interface OidcSyncResult {
  synced: true;
  authUserId: string | null;
  authUserCreated: boolean;
  authUserUpdated: boolean;
}

interface NormalizedOidcSyncPayload {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
  provider: string;
  iss: string;
  emailVerified: boolean;
  rawClaims: Record<string, JsonValue>;
}

interface ShadowAuthUserResult {
  authUserId: string | null;
  created: boolean;
  updated: boolean;
}

export function getSupabaseAdminConfig(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseAdminConfig | null {
  const url = normalizeOptionalText(env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = normalizeOptionalText(env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !serviceRoleKey) return null;

  return { url, serviceRoleKey };
}

export function createSupabaseAdminClient(
  config: SupabaseAdminConfig,
): SupabaseAdminClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as SupabaseAdminClient;
}

export async function syncOidcUserToSupabase(
  client: SupabaseAdminClient,
  payload: OidcSyncPayload,
  env: NodeJS.ProcessEnv = process.env,
): Promise<OidcSyncResult> {
  const normalized = normalizePayload(payload, env);
  const shadowAuthUser = await ensureShadowAuthUser(client, normalized);

  try {
    const { error } = await client.rpc("upsert_oidc_user", {
      p_sub: normalized.sub,
      p_iss: normalized.iss,
      p_email: normalized.email,
      p_email_verified: normalized.emailVerified,
      p_name: normalized.name,
      p_picture: normalized.picture,
      p_provider: normalized.provider,
      p_raw_claims: {
        ...normalized.rawClaims,
        auth_source: "authentik",
        upstream_provider: normalized.provider,
        oidc_issuer: normalized.iss,
        oidc_sub: normalized.sub,
        shadow_supabase_auth_user_id: shadowAuthUser.authUserId,
        shadow_supabase_auth_user_created: shadowAuthUser.created,
        shadow_supabase_auth_user_updated: shadowAuthUser.updated,
      },
    });

    if (error) {
      throw new Error(`upsert_oidc_user failed: ${error.message ?? "unknown error"}`);
    }
  } catch (error: unknown) {
    await rollbackShadowAuthUserIfNeeded(client, shadowAuthUser);
    throw error;
  }

  return {
    synced: true,
    authUserId: shadowAuthUser.authUserId,
    authUserCreated: shadowAuthUser.created,
    authUserUpdated: shadowAuthUser.updated,
  };
}

async function rollbackShadowAuthUserIfNeeded(
  client: SupabaseAdminClient,
  shadowAuthUser: ShadowAuthUserResult,
) {
  if (!shadowAuthUser.created || !shadowAuthUser.authUserId) return;

  const { error } = await client.auth.admin.deleteUser(shadowAuthUser.authUserId);
  if (error) {
    console.error(
      `[auth/sync] Failed to roll back shadow Supabase auth user ${shadowAuthUser.authUserId}: ${error.message ?? "unknown error"}`,
    );
  }
}

function normalizePayload(
  payload: OidcSyncPayload,
  env: NodeJS.ProcessEnv,
): NormalizedOidcSyncPayload {
  const sub = normalizeOptionalText(payload.sub);
  const email = normalizeEmail(payload.email);
  const iss =
    normalizeOptionalText(payload.iss)
    ?? normalizeOptionalText(env.NEXT_PUBLIC_AUTHENTIK_URL)
    ?? DEFAULT_AUTHENTIK_ISSUER;

  if (!sub || !email) {
    throw new Error("OIDC sync requires non-empty sub and email");
  }

  return {
    sub,
    email,
    name: normalizeOptionalText(payload.name),
    picture: normalizeOptionalText(payload.picture),
    provider: normalizeOptionalText(payload.provider) ?? "authentik",
    iss,
    emailVerified: payload.emailVerified ?? true,
    rawClaims: payload.rawClaims ?? {},
  };
}

async function ensureShadowAuthUser(
  client: SupabaseAdminClient,
  payload: NormalizedOidcSyncPayload,
): Promise<ShadowAuthUserResult> {
  const attributes = buildShadowAuthUserAttributes(payload);
  const existing = await findExistingShadowAuthUser(client, payload);

  if (existing) {
    if (!needsShadowAuthUserUpdate(existing, payload)) {
      return { authUserId: existing.id, created: false, updated: false };
    }

    const { data, error } = await client.auth.admin.updateUserById(existing.id, attributes);
    if (error) {
      throw new Error(`Supabase auth user update failed: ${error.message ?? "unknown error"}`);
    }

    return {
      authUserId: data.user?.id ?? existing.id,
      created: false,
      updated: true,
    };
  }

  const { data, error } = await client.auth.admin.createUser(attributes);
  if (error) {
    throw new Error(`Supabase auth user create failed: ${error.message ?? "unknown error"}`);
  }

  return {
    authUserId: data.user?.id ?? null,
    created: true,
    updated: false,
  };
}

async function findExistingShadowAuthUser(
  client: SupabaseAdminClient,
  payload: NormalizedOidcSyncPayload,
): Promise<SupabaseAuthUser | null> {
  let page = 1;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: ADMIN_PAGE_SIZE,
    });

    if (error) {
      throw new Error(`Supabase auth user lookup failed: ${error.message ?? "unknown error"}`);
    }

    const users = data.users ?? [];
    const identityMatch = users.find((user) => matchesAuthentikIdentity(user, payload));
    if (identityMatch) return identityMatch;

    const emailMatch = users.find(
      (user) => normalizeEmail(user.email) === payload.email,
    );
    if (emailMatch) return emailMatch;

    if (!data.nextPage || users.length === 0) return null;
    page = data.nextPage;
  }
}

function needsShadowAuthUserUpdate(
  user: SupabaseAuthUser,
  payload: NormalizedOidcSyncPayload,
): boolean {
  const userMetadata = asRecord(user.user_metadata);
  const appMetadata = asRecord(user.app_metadata);

  return normalizeEmail(user.email) !== payload.email
    || stringOrNull(userMetadata.name) !== payload.name
    || stringOrNull(userMetadata.full_name) !== payload.name
    || stringOrNull(userMetadata.avatar_url) !== payload.picture
    || stringOrNull(userMetadata.oidc_sub) !== payload.sub
    || stringOrNull(userMetadata.oidc_issuer) !== payload.iss
    || stringOrNull(userMetadata.upstream_provider) !== payload.provider
    || stringOrNull(appMetadata.provider) !== "authentik"
    || stringOrNull(appMetadata.auth_source) !== "authentik"
    || stringOrNull(appMetadata.oidc_sub) !== payload.sub
    || stringOrNull(appMetadata.oidc_issuer) !== payload.iss
    || stringOrNull(appMetadata.upstream_provider) !== payload.provider;
}

function matchesAuthentikIdentity(
  user: SupabaseAuthUser,
  payload: NormalizedOidcSyncPayload,
): boolean {
  const appMetadata = asRecord(user.app_metadata);
  return stringOrNull(appMetadata.auth_source) === "authentik"
    && stringOrNull(appMetadata.oidc_sub) === payload.sub
    && stringOrNull(appMetadata.oidc_issuer) === payload.iss;
}

function buildShadowAuthUserAttributes(
  payload: NormalizedOidcSyncPayload,
): Record<string, unknown> {
  return {
    email: payload.email,
    email_confirm: payload.emailVerified,
    role: "authenticated",
    user_metadata: compactObject({
      name: payload.name,
      full_name: payload.name,
      avatar_url: payload.picture,
      oidc_sub: payload.sub,
      oidc_issuer: payload.iss,
      upstream_provider: payload.provider,
    }),
    app_metadata: {
      provider: "authentik",
      auth_source: "authentik",
      oidc_sub: payload.sub,
      oidc_issuer: payload.iss,
      upstream_provider: payload.provider,
    },
  };
}

function compactObject(
  value: Record<string, string | null>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry) result[key] = entry;
  }
  return result;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.toLowerCase() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value
    : null;
}
