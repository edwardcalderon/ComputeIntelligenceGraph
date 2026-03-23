import type { AuthProvider } from "@refinedev/core";
import {
  discoverEndpoints,
  orchestrateLogout,
} from "@edcalderon/auth/authentik";

function getSession() {
  if (typeof window === "undefined") return null;
  try {
    const token     = sessionStorage.getItem("cig_access_token");
    const expiresAt = sessionStorage.getItem("cig_expires_at");
    if (!token) return null;
    if (expiresAt && Date.now() > parseInt(expiresAt, 10)) return null;
    const idToken = sessionStorage.getItem("cig_id_token") ?? undefined;
    const refreshToken = sessionStorage.getItem("cig_refresh_token") ?? undefined;
    return { token, idToken, refreshToken, expiresAt };
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

function getLandingUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function getLandingLoggedOutUrl(): string {
  return `${getLandingUrl()}?logged_out=1`;
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
  const postLogoutRedirectUri = getLandingLoggedOutUrl();
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
    clearSession();

    if (getAuthBackend() !== "authentik") {
      return {
        success: true,
        redirectTo: getLandingLoggedOutUrl(),
      };
    }

    const endSessionUrl = await resolveDashboardLogoutUrl(
      session?.token,
      session?.idToken,
    ).catch(() => getLandingLoggedOutUrl());

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
      redirectTo: getLandingUrl(),
      error: { name: "Unauthenticated", message: "No active session." },
    };
  },

  onError: async (error) => {
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) {
      clearSession();
      return { logout: true, redirectTo: getLandingUrl() };
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
