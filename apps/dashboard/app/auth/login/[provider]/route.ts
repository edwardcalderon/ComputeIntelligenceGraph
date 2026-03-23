import { NextRequest, NextResponse } from "next/server";
import {
  createRelayPageHtml,
  parseRelayParams,
} from "@edcalderon/auth/authentik";

/**
 * GET /auth/login/[provider]?code_challenge=...&state=...&redirect_uri=...&client_id=...&code_verifier=...
 *
 * Relay page that:
 *   1. Stores the PKCE verifier + state in sessionStorage (dashboard origin,
 *      so /auth/callback can read them later for the token exchange).
 *   2. Redirects the browser to a provider-specific Authentik flow that goes
 *      directly to Google/GitHub without showing the Authentik login UI.
 *
 * Why this avoids the Authentik login page:
 *   We redirect to /if/flow/cig-{provider}-login/?next=<oidc-authorize-url>.
 *   That flow has a single Redirect Stage pointing to /source/oauth/login/{provider}/.
 *   Authentik's flow executor stores SESSION_KEY_GET (with the `next` param) when the
 *   flow starts, so after Google/GitHub auth completes, SourceFlowManager reads it and
 *   redirects back to the OIDC authorize endpoint → issues the code → back to /auth/callback.
 *
 * Why sessionStorage must be set HERE:
 *   The landing page (cig.lat / localhost:3000) and the dashboard
 *   (app.cig.technology / localhost:3001) are different origins.
 *   sessionStorage is per-origin, so the landing can't write to the dashboard's
 *   storage. This page runs on the dashboard origin, bridging the gap.
 */

const ALLOWED_PROVIDERS = new Set(["google", "github"]);

/** Authentik flow slug per provider — these flows have a single Redirect Stage
 *  that goes straight to /source/oauth/login/{provider}/ without any login UI. */
const PROVIDER_FLOW: Record<string, string> = {
  google: "cig-google-login",
  github: "cig-github-login",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (!ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  // The shared relay parser expects provider in the incoming parameter bundle.
  // Our route carries it in the path, so we inject it before validation.
  const relaySearchParams = new URLSearchParams(req.nextUrl.searchParams);
  relaySearchParams.set("provider", provider);
  const relayParams = parseRelayParams(relaySearchParams);
  if (!relayParams) {
    return NextResponse.json({ error: "Missing PKCE parameters" }, { status: 400 });
  }

  const authentikUrl = process.env.NEXT_PUBLIC_AUTHENTIK_URL ?? "https://auth.cig.technology";
  const clientId = req.nextUrl.searchParams.get("client_id");
  const redirectUri = req.nextUrl.searchParams.get("redirect_uri");
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Missing PKCE parameters" }, { status: 400 });
  }
  const authorizePath = `${authentikUrl.replace(/\/$/, "")}/application/o/authorize/`;
  const html = createRelayPageHtml(
    {
      issuer: authentikUrl,
      clientId,
      redirectUri,
      authorizePath,
      providerFlowSlugs: PROVIDER_FLOW,
    },
    {
      provider,
      codeVerifier: relayParams.codeVerifier,
      codeChallenge: relayParams.codeChallenge,
      state: relayParams.state,
      next: relayParams.next,
    },
  ).html;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
