"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { exchangeAuthentikCode } from "@cig/auth";

/**
 * Handles two callback patterns:
 *
 * 1. Authentik PKCE (new):
 *    /auth/callback?code=...&state=...&redirect=/graph
 *    → exchanges code for tokens, stores in sessionStorage
 *
 * 2. Legacy hash fragment (Supabase-style, kept for backwards compat):
 *    /auth/callback?redirect=/graph#access_token=...&expires_in=3600
 *    → reads tokens from URL hash directly
 */
export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash         = window.location.hash.slice(1);
    const search       = window.location.search.slice(1);
    const hashParams   = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(search);

    const landingUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";
    const redirect = resolveRedirect(
      searchParams.get("redirect"),
      landingUrl,
      dashboardUrl,
    );

    async function handle() {
      const code = searchParams.get("code");

      if (code) {
        // ── Authentik PKCE flow ──────────────────────────────────────────
        const issuerUrl  = process.env.NEXT_PUBLIC_AUTHENTIK_URL    ?? "https://auth.cig.technology";
        const clientId   = process.env.NEXT_PUBLIC_AUTHENTIK_CLIENT_ID ?? "G4D6S7WXUoCNZxY7uZSbD08zO3cuXEZwSyUATw2v";
        // Use our own origin — this must match the redirect_uri that was sent
        // to the authorize endpoint (built from NEXT_PUBLIC_DASHBOARD_URL in the landing).
        const dashUrl    = window.location.origin;
        const redirectUri = `${dashUrl.replace(/\/$/, "")}/auth/callback`;

        try {
          const tokens = await exchangeAuthentikCode(
            { issuerUrl, clientId, redirectUri },
            code,
            searchParams.get("state") ?? undefined
          );
          storeSession(tokens.access_token, tokens.id_token, tokens.refresh_token, tokens.expires_in);
        } catch (err: unknown) {
          setError((err as Error).message ?? "Authentication failed");
          return;
        }
      } else {
        // ── Legacy hash-fragment flow ────────────────────────────────────
        const accessToken  = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token") ?? undefined;
        const expiresIn    = parseInt(hashParams.get("expires_in") ?? "3600", 10);
        if (accessToken) {
          storeSession(accessToken, undefined, refreshToken, expiresIn);
        }
      }

      // Sync user to Supabase (fire-and-forget, non-blocking)
      const idTokRaw = sessionStorage.getItem("cig_id_token") ?? sessionStorage.getItem("cig_access_token");
      if (idTokRaw) {
        try {
          const payload = JSON.parse(atob(idTokRaw.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
          fetch("/api/auth/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body: JSON.stringify({
              sub: payload.sub ?? "",
              email: payload.email ?? "",
              name: payload.name ?? payload.preferred_username ?? "",
              picture: payload.picture ?? "",
              provider: sessionStorage.getItem("cig_social_provider") ?? "authentik",
            }),
          }).catch(() => {}); // non-blocking
        } catch { /* ignore JWT decode errors */ }
      }

      if (redirect.startsWith("http")) {
        // Cross-origin redirect (back to landing): pass tokens in hash fragment
        // so the landing can also store them in its sessionStorage.
        const token = sessionStorage.getItem("cig_access_token") ?? "";
        const idTok = sessionStorage.getItem("cig_id_token") ?? "";
        const expIn = sessionStorage.getItem("cig_expires_in") ?? "3600";
        const socialProvider = sessionStorage.getItem("cig_social_provider") ?? "";
        const hashParams = new URLSearchParams({
          access_token: token,
          ...(idTok && { id_token: idTok }),
          expires_in: expIn,
          ...(socialProvider && { social_provider: socialProvider }),
        });
        window.location.href = `${redirect}#${hashParams}`;
      } else {
        router.replace(redirect);
      }
    }

    handle();
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center px-4">
          <p className="text-red-400 text-sm">{error}</p>
          <a
            href={process.env.NEXT_PUBLIC_SITE_URL ?? "/"}
            className="text-xs text-zinc-500 hover:text-zinc-300 underline transition-colors"
          >
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4">
        <div className="relative size-12">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
        </div>
        <p className="text-sm text-cyan-400 animate-pulse tracking-wide">
          Connecting to dashboard…
        </p>
      </div>
    </div>
  );
}

function storeSession(accessToken: string, idToken: string | undefined, refreshToken: string | undefined, expiresIn: number) {
  try {
    // Clear stale tokens first to prevent showing a previous user's info
    sessionStorage.removeItem("cig_access_token");
    sessionStorage.removeItem("cig_id_token");
    sessionStorage.removeItem("cig_refresh_token");
    sessionStorage.removeItem("cig_expires_in");
    sessionStorage.removeItem("cig_expires_at");

    const expiresAtMs = Date.now() + expiresIn * 1000;
    sessionStorage.setItem("cig_access_token", accessToken);
    if (idToken) sessionStorage.setItem("cig_id_token", idToken);
    if (refreshToken) sessionStorage.setItem("cig_refresh_token", refreshToken);
    sessionStorage.setItem("cig_expires_in", String(expiresIn));
    sessionStorage.setItem("cig_expires_at", String(expiresAtMs));
    const expiresAtDate = new Date(expiresAtMs).toUTCString();
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `cig_has_session=1; path=/; expires=${expiresAtDate}; SameSite=Lax${secure}`;
  } catch {
    // sessionStorage blocked (private mode) — continue anyway
  }
}

function resolveRedirect(
  rawRedirect: string | null,
  landingUrl: string,
  dashboardUrl: string,
) {
  if (!rawRedirect) return landingUrl;

  // Allow relative in-app redirects, but reject scheme-relative URLs.
  if (rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")) {
    return rawRedirect;
  }

  try {
    const redirectUrl = new URL(rawRedirect);
    const allowedOrigins = new Set(
      [landingUrl, dashboardUrl].map((value) => new URL(value).origin),
    );
    return allowedOrigins.has(redirectUrl.origin)
      ? redirectUrl.toString()
      : landingUrl;
  } catch {
    return landingUrl;
  }
}
