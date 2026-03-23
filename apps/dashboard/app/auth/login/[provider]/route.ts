import { NextRequest, NextResponse } from "next/server";

/**
 * GET /auth/login/[provider]?code_challenge=...&state=...&redirect_uri=...&client_id=...&code_verifier=...
 *
 * Server-side relay that:
 *   1. Persists the PKCE verifier/state/provider in short-lived cookies on the
 *      dashboard origin, so the Authentik callback can complete the exchange.
 *   2. Redirects the browser directly into the provider-specific Authentik
 *      flow that jumps straight to Google/GitHub.
 *
 * This removes the previous interstitial relay page. The browser now sees a
 * real HTTP redirect instead of a rendered "redirecting" screen.
 */

const ALLOWED_PROVIDERS = new Set(["google", "github"]);

const PROVIDER_FLOW: Record<string, string> = {
  google: "cig-google-login",
  github: "cig-github-login",
};

const PKCE_VERIFIER_COOKIE = "cig_pkce_verifier";
const PKCE_STATE_COOKIE = "cig_pkce_state";
const SOCIAL_PROVIDER_COOKIE = "cig_social_provider";
const PKCE_COOKIE_MAX_AGE_SECONDS = 10 * 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (!ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const clientId = req.nextUrl.searchParams.get("client_id");
  const redirectUri = req.nextUrl.searchParams.get("redirect_uri");
  const codeChallenge = req.nextUrl.searchParams.get("code_challenge");
  const codeVerifier = req.nextUrl.searchParams.get("code_verifier");
  const state = req.nextUrl.searchParams.get("state");

  if (!clientId || !redirectUri || !codeChallenge || !codeVerifier || !state) {
    return NextResponse.json({ error: "Missing PKCE parameters" }, { status: 400 });
  }

  const authentikUrl = process.env.NEXT_PUBLIC_AUTHENTIK_URL ?? "https://auth.cig.technology";
  const authBase = authentikUrl.replace(/\/$/, "");
  const authorizePath = `${authBase}/application/o/authorize/`;
  const flowUrl = new URL(`/if/flow/${PROVIDER_FLOW[provider]}/`, authBase);
  flowUrl.searchParams.set("next", buildAuthorizeUrl(authorizePath, {
    clientId,
    redirectUri,
    state,
    codeChallenge,
  }));

  const response = NextResponse.redirect(flowUrl, 302);
  setPkceCookies(response, req, {
    verifier: codeVerifier,
    state,
    provider,
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function buildAuthorizeUrl(
  authorizePath: string,
  params: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
  },
): string {
  const authorizeParams = new URLSearchParams({
    response_type: "code",
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: "openid email profile",
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  });

  return `${authorizePath}?${authorizeParams}`;
}

function setPkceCookies(
  response: NextResponse,
  req: NextRequest,
  session: {
    verifier: string;
    state: string;
    provider: string;
  },
) {
  const secure = req.nextUrl.protocol === "https:";
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: PKCE_COOKIE_MAX_AGE_SECONDS,
  };

  response.cookies.set(PKCE_VERIFIER_COOKIE, session.verifier, cookieOptions);
  response.cookies.set(PKCE_STATE_COOKIE, session.state, cookieOptions);
  response.cookies.set(SOCIAL_PROVIDER_COOKIE, session.provider, cookieOptions);
}
