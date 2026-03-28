import type { AuthProvider } from "@refinedev/core";
import { getSupabaseClient, revokeSessionViaApi } from "@cig/auth";
import { resolveDashboardAuthSource } from "./sessionAuth";
import {
  buildDashboardRequestPath,
  isProtectedDashboardHostname,
  resolveLandingLoggedOutUrl,
  resolveLandingSignInUrl,
} from "./siteUrl";

function getSession() {
  if (typeof window === "undefined") return null;
  try {
    const token     = sessionStorage.getItem("cig_access_token");
    const expiresAt = sessionStorage.getItem("cig_expires_at");
    if (!token) {
      const legacyToken = localStorage.getItem("cig-access-token");
      if (!legacyToken) return null;
      return {
        token: legacyToken,
        idToken: undefined,
        refreshToken: undefined,
        expiresAt: null,
        authSource: resolveDashboardAuthSource({
          explicitAuthSource: localStorage.getItem("cig_auth_source"),
          accessToken: legacyToken,
        }),
      };
    }
    if (expiresAt && Date.now() > parseInt(expiresAt, 10)) return null;
    const idToken = sessionStorage.getItem("cig_id_token") ?? undefined;
    const refreshToken = sessionStorage.getItem("cig_refresh_token") ?? undefined;
    const authSource = resolveDashboardAuthSource({
      explicitAuthSource: sessionStorage.getItem("cig_auth_source"),
      accessToken: token,
      idToken,
    });
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
    localStorage.removeItem("cig-access-token");
    // Expire the middleware cookie immediately
    document.cookie = "cig_has_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  } catch { /* ignore */ }
}

function getBrowserUrlContext() {
  if (typeof window === "undefined") {
    return {};
  }

  return {
    hostname: window.location.hostname,
    protocol: window.location.protocol,
  };
}

function getCurrentDashboardRequestPath(): string {
  if (typeof window === "undefined") {
    return "/";
  }

  return buildDashboardRequestPath(window.location.pathname, window.location.search);
}

function resolveDashboardSignInRedirect(): string {
  return resolveLandingSignInUrl({
    ...getBrowserUrlContext(),
    dashboardPath: getCurrentDashboardRequestPath(),
  });
}

function shouldProtectCurrentDashboardHost(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return isProtectedDashboardHostname(window.location.hostname);
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

export const authProvider: AuthProvider = {
  /** Login happens on the landing page — not used inside the dashboard. */
  login: async () => ({ success: true }),

  logout: async () => {
    const session = getSession();
    const sessionSource = session?.authSource ?? null;
    const token = session?.token;
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
        redirectTo: resolveLandingLoggedOutUrl(),
      };
    }

    void revokeSessionViaApi(token);

    return {
      success: true,
      redirectTo: resolveLandingLoggedOutUrl(),
    };
  },

  check: async () => {
    const session = getSession();
    if (session) return { authenticated: true };

    if (!shouldProtectCurrentDashboardHost()) {
      return { authenticated: true };
    }

    return {
      authenticated: false,
      redirectTo: resolveDashboardSignInRedirect(),
      error: { name: "Unauthenticated", message: "No active session." },
    };
  },

  onError: async (error) => {
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) {
      clearSession();

      if (shouldProtectCurrentDashboardHost()) {
        return { logout: true, redirectTo: resolveDashboardSignInRedirect() };
      }
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
    const authBackend = session.authSource === "supabase"
      ? "supabase"
      : (process.env.NEXT_PUBLIC_AUTH_PROVIDER as string) || "authentik";
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
