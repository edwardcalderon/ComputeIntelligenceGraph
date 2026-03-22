import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ synced: false, reason: "supabase_not_configured" });
  }

  let body: { sub: string; email: string; name: string; picture?: string; provider?: string; iss?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.sub || !body.email) {
    return NextResponse.json({ error: "Missing sub or email" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { error } = await supabase.rpc("upsert_oidc_user", {
      p_sub: body.sub,
      p_iss: body.iss ?? process.env.NEXT_PUBLIC_AUTHENTIK_URL ?? "https://auth.cig.technology",
      p_email: body.email,
      p_email_verified: true,
      p_name: body.name || null,
      p_picture: body.picture || null,
      p_provider: body.provider || "authentik",
      p_raw_claims: {},
    });

    if (error) {
      console.error("[auth/sync] upsert_oidc_user error:", error.message);
      return NextResponse.json({ synced: false, reason: error.message });
    }

    return NextResponse.json({ synced: true });
  } catch (err: unknown) {
    console.error("[auth/sync] Supabase sync failed:", err);
    return NextResponse.json({ synced: false, reason: "sync_error" });
  }
}
