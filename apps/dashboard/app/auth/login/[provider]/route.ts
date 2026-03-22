import { NextRequest, NextResponse } from "next/server";

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

  const sp = req.nextUrl.searchParams;
  const codeChallenge       = sp.get("code_challenge");
  const codeChallengeMethod = sp.get("code_challenge_method") ?? "S256";
  const state               = sp.get("state");
  const redirectUri         = sp.get("redirect_uri");
  const clientId            = sp.get("client_id");
  const codeVerifier        = sp.get("code_verifier");

  if (!codeChallenge || !state || !redirectUri || !clientId || !codeVerifier) {
    return NextResponse.json({ error: "Missing PKCE parameters" }, { status: 400 });
  }

  const authentikUrl = process.env.NEXT_PUBLIC_AUTHENTIK_URL ?? "https://auth.cig.technology";

  // Build the OIDC authorize URL — this becomes the `next` param for the flow.
  // After the social login completes, Authentik will follow this URL to issue the code.
  const oidcParams = new URLSearchParams({
    response_type:          "code",
    client_id:              clientId,
    redirect_uri:           redirectUri,
    scope:                  "openid email profile",
    state,
    code_challenge:         codeChallenge,
    code_challenge_method:  codeChallengeMethod,
  });
  const authorizeUrl = `${authentikUrl}/application/o/authorize/?${oidcParams}`;

  // Build the flow URL.
  // The /if/flow/ shell (Authentik frontend) forwards all query params to the API executor
  // as ?query=<url-encoded-qs>. The executor parses that into SESSION_KEY_GET, which
  // SourceFlowManager reads after social auth to find the "next" redirect target.
  // So we pass ?next=<authorizeUrl> directly — the shell handles the encoding.
  const flowSlug = PROVIDER_FLOW[provider];
  const flowUrl = `${authentikUrl}/if/flow/${flowSlug}/?next=${encodeURIComponent(authorizeUrl)}`;

  // Render a minimal page that stores PKCE params in sessionStorage then redirects.
  // This runs on the dashboard origin so /auth/callback can read the verifier later.
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Redirecting…</title>
<style>body{margin:0;background:#09090b;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;color:#a1a1aa}
.s{width:32px;height:32px;border:3px solid rgba(34,211,238,.15);border-top-color:#22d3ee;border-radius:50%;animation:r .6s linear infinite;margin:0 auto 16px}
@keyframes r{to{transform:rotate(360deg)}}</style></head>
<body><div style="text-align:center"><div class="s"></div><p>Connecting…</p></div>
<script>
try{sessionStorage.setItem("cig_pkce_verifier",${JSON.stringify(codeVerifier)});sessionStorage.setItem("cig_pkce_state",${JSON.stringify(state)});sessionStorage.setItem("cig_social_provider",${JSON.stringify(provider)})}catch(e){}
window.location.href=${JSON.stringify(flowUrl)};
</script></body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
