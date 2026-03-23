import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  getSupabaseAdminConfig,
  type OidcSyncPayload,
  syncOidcUserToSupabase,
} from "../../../../lib/authSync";

/**
 * POST /api/auth/sync
 *
 * Upserts a user into public.users after successful Authentik login,
 * using the upsert_oidc_user() RPC from @edcalderon/auth migrations.
 *
 * Uses the Supabase service role key (server-side only) — the RPC
 * rejects calls from anon/authenticated roles.
 */
export async function POST(req: NextRequest) {
  const config = getSupabaseAdminConfig();

  if (!config) {
    console.error(
      "[auth/sync] Missing Supabase admin config. Expected SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
    );
    return NextResponse.json(
      { synced: false, reason: "supabase_not_configured" },
      { status: 503 },
    );
  }

  let body: OidcSyncPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.sub || !body.email) {
    return NextResponse.json({ error: "Missing sub or email" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient(config);

  try {
    const result = await syncOidcUserToSupabase(supabase, body);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[auth/sync] Supabase sync failed:", err);
    return NextResponse.json(
      {
        synced: false,
        reason: err instanceof Error ? err.message : "sync_error",
      },
      { status: 500 },
    );
  }
}
