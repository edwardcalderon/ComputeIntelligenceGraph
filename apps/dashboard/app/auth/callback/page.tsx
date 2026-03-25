"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@cig-technology/i18n/react";
import { resolveLandingUrl } from "../../../lib/siteUrl";
import {
  clearRelayStorage,
  discoverEndpoints,
  exchangeCode,
  readRelayStorage,
  resolveSafeRedirect,
  type ProvisioningAdapter,
  type ProvisioningPayload,
  type ProvisioningResult,
} from "@edcalderon/auth/authentik";

const AUTH_SYNC_TIMEOUT_MS = 10_000;
const AUTH_SYNC_MAX_ATTEMPTS = 2;

/**
 * Handles the dashboard handoff patterns:
 *
 * 1. Landing-to-dashboard handoff:
 *    /auth/callback?redirect=/graph#access_token=...&expires_in=3600
 *    -> reads tokens from URL hash directly and stores them in sessionStorage
 *
 * 2. Legacy Authentik PKCE callback (older login URIs only):
 *    /auth/callback?code=...&state=...&redirect=/graph
 *    -> exchanges code for tokens, stores them in sessionStorage
 *
 * The current social-login flow now uses /auth/login-callback for the
 * Authentik code exchange so this page stays focused on the dashboard handoff.
 */
export default function AuthCallback() {
  const router = useRouter();
  const t = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }
    handledRef.current = true;

    const hash = window.location.hash.slice(1);
    const search = window.location.search.slice(1);
    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(search);

    const landingUrl = resolveLandingUrl();
    const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

    async function handle() {
      const code = searchParams.get("code");
      const relayState = readRelayStorage(window.sessionStorage);
      const redirect = resolveSafeRedirect(
        searchParams.get("redirect") ?? relayState?.next ?? null,
        {
          allowedOrigins: [landingUrl, dashboardUrl],
          fallbackUrl: landingUrl,
        },
      );

      if (code) {
        try {
          if (!relayState) {
            throw new Error("Missing Authentik relay state");
          }

          const issuer = getAuthentikIssuer();
          const endpoints = await resolveAuthentikEndpoints(issuer);
          const callbackUrl = new URL("/auth/callback", window.location.origin).toString();

          if ((searchParams.get("state") ?? "") !== relayState.state) {
            throw new Error("Invalid callback state — possible CSRF or expired session");
          }

          const tokens = await exchangeCode(
            {
              issuer,
              clientId: getAuthentikClientId(),
              redirectUri: callbackUrl,
              tokenEndpoint: endpoints.token,
              userinfoEndpoint: endpoints.userinfo,
            },
            code,
            relayState.codeVerifier,
          );
          const claims = buildClaimsFromTokens(tokens.id_token ?? tokens.access_token, issuer);
          const provisioningResult = await createSupabaseProvisioningAdapter().sync({
            sub: claims.sub,
            iss: claims.iss,
            email: (claims.email ?? "").toLowerCase(),
            emailVerified: claims.email_verified,
            name: claims.name ?? claims.preferred_username,
            picture: claims.picture,
            provider: relayState.provider,
            rawClaims: claims,
          });

          if (!provisioningResult.synced) {
            throw new Error(provisioningResult.error ?? "Supabase provisioning failed");
          }

          storeSession(
            tokens.access_token,
            tokens.id_token,
            tokens.refresh_token,
            tokens.expires_in ?? 3600,
            relayState.provider,
          );
          clearRelayStorage(window.sessionStorage);
        } catch (err: unknown) {
          clearStoredSession();
          clearRelayStorage(window.sessionStorage);
          console.error("[auth/callback] Authentik callback failed:", err);
          setError((err as Error).message ?? "Authentication failed");
          return;
        }
      } else {
        // Legacy hash-fragment flow
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token") ?? undefined;
        const expiresIn = parseInt(hashParams.get("expires_in") ?? "3600", 10);
        const socialProvider = hashParams.get("social_provider") ?? undefined;
        if (accessToken) {
          storeSession(accessToken, undefined, refreshToken, expiresIn, socialProvider);
        }
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
        window.location.replace(`${redirect}#${hashParams}`);
      } else {
        router.replace(redirect);
      }
    }

    handle();
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex max-w-sm flex-col items-center gap-4 px-4 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <a
            href={resolveLandingUrl()}
            className="text-xs text-zinc-500 underline transition-colors hover:text-zinc-300"
          >
            {t("auth.backToSignIn")}
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
        <p className="animate-pulse text-sm tracking-wide text-cyan-400">
          {t("auth.authenticating")}
        </p>
      </div>
    </div>
  );
}

function getAuthentikIssuer(): string {
  const base = process.env.NEXT_PUBLIC_AUTHENTIK_URL ?? "https://auth.cig.technology";
  return new URL("/application/o/cig-dashboard/", base).toString();
}

function getAuthentikClientId(): string {
  return process.env.NEXT_PUBLIC_AUTHENTIK_CLIENT_ID ??
    "G4D6S7WXUoCNZxY7uZSbD08zO3cuXEZwSyUATw2v";
}

function resolveAuthentikEndpoints(issuer: string): Promise<{ token: string; userinfo: string }> {
  const issuerUrl = issuer.endsWith("/") ? issuer : `${issuer}/`;
  const fallback = {
    token: new URL("../token/", issuerUrl).toString(),
    userinfo: new URL("../userinfo/", issuerUrl).toString(),
  };

  return discoverEndpoints(issuer)
    .then((endpoints) => ({
      token: endpoints.token || fallback.token,
      userinfo: endpoints.userinfo || fallback.userinfo,
    }))
    .catch(() => fallback);
}

function createSupabaseProvisioningAdapter(): ProvisioningAdapter {
  return {
    sync: async (payload: ProvisioningPayload): Promise<ProvisioningResult> => {
      let lastResult: ProvisioningResult | null = null;

      for (let attempt = 0; attempt < AUTH_SYNC_MAX_ATTEMPTS; attempt += 1) {
        lastResult = await syncUserToSupabaseOnce(payload);
        if (lastResult.synced) {
          return lastResult;
        }

        if (attempt < AUTH_SYNC_MAX_ATTEMPTS - 1) {
          await delay(250 * (attempt + 1));
        }
      }

      return lastResult ?? {
        synced: false,
        error: "Supabase provisioning failed",
        errorCode: "provisioning_failed",
      };
    },
  };
}

async function syncUserToSupabaseOnce(
  payload: ProvisioningPayload,
): Promise<ProvisioningResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), AUTH_SYNC_TIMEOUT_MS);

  try {
    const response = await fetch("/api/auth/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        sub: payload.sub,
        iss: payload.iss,
        email: payload.email,
        emailVerified: payload.emailVerified ?? true,
        name: payload.name ?? "",
        picture: payload.picture ?? "",
        provider: payload.provider ?? "authentik",
        rawClaims: payload.rawClaims ?? {},
      }),
    });

    const result = (await response.json().catch(() => null)) as
      | { synced?: boolean; reason?: string }
      | null;

    if (!response.ok || !result?.synced) {
      const reason = result?.reason ?? `http_${response.status}`;
      return {
        synced: false,
        error: `Supabase provisioning failed: ${reason}`,
        errorCode: reason,
      };
    }

    return { synced: true };
  } catch (err: unknown) {
    return {
      synced: false,
      error: err instanceof Error ? err.message : "Supabase provisioning failed",
      errorCode: err instanceof DOMException && err.name === "AbortError" ? "timeout" : "network_error",
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function storeSession(
  accessToken: string,
  idToken: string | undefined,
  refreshToken: string | undefined,
  expiresIn: number,
  socialProvider?: string,
) {
  try {
    // Clear stale tokens first to prevent showing a previous user's info
    sessionStorage.removeItem("cig_access_token");
    sessionStorage.removeItem("cig_id_token");
    sessionStorage.removeItem("cig_refresh_token");
    sessionStorage.removeItem("cig_expires_in");
    sessionStorage.removeItem("cig_expires_at");
    sessionStorage.removeItem("cig_auth_source");
    sessionStorage.removeItem("cig_social_provider");

    const expiresAtMs = Date.now() + expiresIn * 1000;
    sessionStorage.setItem("cig_access_token", accessToken);
    if (idToken) sessionStorage.setItem("cig_id_token", idToken);
    if (refreshToken) sessionStorage.setItem("cig_refresh_token", refreshToken);
    if (socialProvider) sessionStorage.setItem("cig_social_provider", socialProvider);
    sessionStorage.setItem("cig_auth_source", "authentik");
    sessionStorage.setItem("cig_expires_in", String(expiresIn));
    sessionStorage.setItem("cig_expires_at", String(expiresAtMs));
    const expiresAtDate = new Date(expiresAtMs).toUTCString();
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "; Secure"
        : "";
    document.cookie = `cig_has_session=1; path=/; expires=${expiresAtDate}; SameSite=Lax${secure}`;
  } catch {
    // sessionStorage blocked (private mode) — continue anyway
  }
}

function clearStoredSession() {
  try {
    sessionStorage.removeItem("cig_access_token");
    sessionStorage.removeItem("cig_id_token");
    sessionStorage.removeItem("cig_refresh_token");
    sessionStorage.removeItem("cig_expires_in");
    sessionStorage.removeItem("cig_expires_at");
    sessionStorage.removeItem("cig_auth_source");
    sessionStorage.removeItem("cig_social_provider");
    document.cookie = "cig_has_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  } catch {
    // sessionStorage blocked — continue anyway
  }
}

function buildClaimsFromTokens(
  token: string,
  issuer: string,
): {
  sub: string;
  iss: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  picture?: string;
} {
  const claims = decodeJwtPayload(token) ?? {};
  const sub = pickString(claims.sub);
  if (!sub) {
    throw new Error("SESSION_ERROR: ID token missing required claim (sub)");
  }

  return {
    sub,
    iss: pickString(claims.iss) ?? issuer,
    email: pickString(claims.email),
    email_verified: pickBoolean(claims.email_verified),
    name: pickString(claims.name),
    preferred_username: pickString(claims.preferred_username),
    picture: pickString(claims.picture),
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function pickBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
