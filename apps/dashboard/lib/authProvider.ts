import type { AuthProvider } from "@refinedev/core";

function getSession() {
  if (typeof window === "undefined") return null;
  try {
    const token     = sessionStorage.getItem("cig_access_token");
    const expiresAt = sessionStorage.getItem("cig_expires_at");
    if (!token) return null;
    if (expiresAt && Date.now() > parseInt(expiresAt, 10)) return null;
    return { token, expiresAt };
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

export const authProvider: AuthProvider = {
  /** Login happens on the landing page — not used inside the dashboard. */
  login: async () => ({ success: true }),

  logout: async () => {
    clearSession();
    // Redirect to landing with ?signout=1 so the landing app can revoke the
    // token and run Authentik RP-initiated logout with its own session copy.
    return {
      success: true,
      redirectTo: `${getLandingUrl()}?signout=1`,
    };
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
        ? `CIG Auth: ${socialProvider.charAt(0).toUpperCase()}${socialProvider.slice(1)}`
        : "CIG Auth";

    return { id: payload.sub as string, name, email, avatar, provider: providerLabel };
  },

  getPermissions: async () => null,
};
