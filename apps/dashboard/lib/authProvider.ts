import type { AuthProvider } from "@refinedev/core";
import {
  discoverEndpoints,
  orchestrateLogout,
} from "@edcalderon/auth/authentik";
import { getSupabaseClient } from "@cig/auth";
import {
  resolveLandingLoggedOutUrl,
  resolveLandingUrl,
} from "./siteUrl";

function getSession() {
  if (typeof window === "undefined") return null;
  try {
    const token     = sessionStorage.getItem("cig_access_token");
    const expiresAt = sessionStorage.getItem("cig_expires_at");
    if (!token) return null;
    if (expiresAt && Date.now() > parseInt(expiresAt, 10)) return null;
    const idToken = sessionStorage.getItem("cig_id_token") ?? undefined;
    const refreshToken = sessionStorage.getItem("cig_refresh_token") ?? undefined;
    const authSource = (sessionStorage.getItem("cig_auth_source") as "authentik" | "supabase" | null) ?? null;
    return { token, idToken, refreshToken, expiresAt, authSource };
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem("cig_access_token");
    sessionStorage.removeItem("cig_id_token");
    sessionStorage.removeItem("cig_refresh_token");
    sessionStorage.removeItem("cig_expires_in");
    sessionStorage.removeItem("cig_expires_at");
    sessionStorage.removeItem("cig_auth_source");
    // Expire the middleware cookie immediately
    document.cookie = "cig_has_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  } catch { /* ignore */ }
}

/** Decode the JWT payload without a library. */
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function getAuthentikIssuer(): string {
  const base = process.env.NEXT_PUBLIC_AUTHENTIK_URL ?? "https://auth.cig.technology";
  return new URL("/application/o/cig-dashboard/", base).toString();
}

function getAuthentikClientId(): string {
  return process.env.NEXT_PUBLIC_AUTHENTIK_CLIENT_ID ??
    "G4D6S7WXUoCNZxY7uZSbD08zO3cuXEZwSyUATw2v";
}

function getAuthBackend(): "authentik" | "supabase" {
  return (process.env.NEXT_PUBLIC_AUTH_PROVIDER as "authentik" | "supabase") || "authentik";
}

function formatAuthProviderLabel(provider: string): string {
  switch (provider.toLowerCase()) {
    case "github":
      return "GitHub";
    case "google":
      return "Google";
    default:
      return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
}

async function resolveDashboardLogoutUrl(
  accessToken: string | undefined,
  idToken: string | undefined,
): Promise<string> {
  const issuer = decodeJwt(idToken ?? accessToken ?? "")?.iss;
  const fallbackIssuer = typeof issuer === "string" && issuer.trim()
    ? issuer
    : getAuthentikIssuer();
  const issuerUrl = fallbackIssuer.endsWith("/")
    ? fallbackIssuer
    : `${fallbackIssuer}/`;
  const postLogoutRedirectUri = resolveLandingLoggedOutUrl();
  const baseConfig = {
    issuer: fallbackIssuer,
    postLogoutRedirectUri,
    endSessionEndpoint: new URL("end-session/", issuerUrl).toString(),
    revocationEndpoint: new URL("revoke/", issuerUrl).toString(),
    clientId: getAuthentikClientId(),
  };

  try {
    const endpoints = await discoverEndpoints(fallbackIssuer).catch(() => null);
    const logoutConfig = endpoints
      ? {
          ...baseConfig,
          endSessionEndpoint: endpoints.endSession ?? baseConfig.endSessionEndpoint,
          revocationEndpoint: endpoints.revocation ?? baseConfig.revocationEndpoint,
        }
      : baseConfig;
    const result = await orchestrateLogout(logoutConfig, {
      accessToken,
      idToken,
    });
    return result.endSessionUrl;
  } catch {
    const result = await orchestrateLogout(baseConfig, {
      accessToken,
      idToken,
    });
    return result.endSessionUrl;
  }
}

export const authProvider: AuthProvider = {
  /** Login happens on the landing page — not used inside the dashboard. */
  login: async () => ({ success: true }),

  logout: async () => {
    const session = getSession();
    const sessionSource = session?.authSource ?? null;
    clearSession();

    if (sessionSource === "supabase" || getAuthBackend() !== "authentik") {
      const supabase = getSupabaseClient();
      try {
        // Supabase email sessions should log out locally; the hosted
        // end-session redirect is not needed here and can fail without an API
        // key when Supabase tries to round-trip through its OIDC logout page.
        await supabase?.auth.signOut({ scope: "local" });
      } catch {
        // Ignore Supabase sign-out failures and still clear the app session.
      }

      return {
        success: true,
        redirectTo: resolveLandingUrl(),
      };
    }

    const endSessionUrl = await resolveDashboardLogoutUrl(
      session?.token,
      session?.idToken,
    ).catch(() => resolveLandingLoggedOutUrl());

    if (typeof window !== "undefined") {
      window.location.replace(endSessionUrl);
    }

    return { success: true };
  },

  check: async () => {
    const session = getSession();
    if (session) return { authenticated: true };
    // No session → send straight to landing sign-in
    return {
      authenticated: false,
      redirectTo: resolveLandingUrl(),
      error: { name: "Unauthenticated", message: "No active session." },
    };
  },

  onError: async (error) => {
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) {
      clearSession();
      return { logout: true, redirectTo: resolveLandingUrl() };
    }
    return { error };
  },

  getIdentity: async () => {
    const session = getSession();
    if (!session) return null;

    // Prefer id_token (has full OIDC claims: email, name, picture).
    // Fall back to access_token for legacy sessions.
    const idToken = (() => {
      try { return sessionStorage.getItem("cig_id_token"); } catch { return null; }
    })();
    const payload = decodeJwt(idToken ?? session.token);
    if (!payload) return null;

    const email = (payload.email as string) ?? "";
    const name =
      (payload.name as string) ??
      (payload.preferred_username as string) ??
      (payload.given_name as string) ??
      email.split("@")[0] ??
      "User";
    const avatar = (payload.picture as string) ?? null;

    // Detect auth provider and social provider for profile display
    const authBackend = (process.env.NEXT_PUBLIC_AUTH_PROVIDER as string) || "authentik";
    const socialProvider = (() => {
      try { return sessionStorage.getItem("cig_social_provider") ?? ""; } catch { return ""; }
    })();
    const providerLabel = authBackend === "supabase"
      ? "Supabase OAuth"
      : socialProvider
        ? `CIG Auth: ${formatAuthProviderLabel(socialProvider)}`
        : "CIG Auth";

    return { id: payload.sub as string, name, email, avatar, provider: providerLabel };
  },

  getPermissions: async () => null,
};
