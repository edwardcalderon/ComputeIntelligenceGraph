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

/**
 * Where to send the user after explicit logout vs unauthenticated access:
 *
 * - Explicit logout   → /signed-out  (in-app farewell page, then user clicks "Sign in")
 * - Unauthenticated   → NEXT_PUBLIC_SITE_URL (landing sign-in, works local & prod)
 * - 401/403 API error → NEXT_PUBLIC_SITE_URL (session invalid, go log in again)
 */
const SIGNED_OUT_PATH = "/signed-out";

function getLandingUrl(): string {
  if (typeof window !== "undefined") {
    // In the browser NEXT_PUBLIC_* vars are baked in at build time
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export const authProvider: AuthProvider = {
  /** Login happens on the landing page — not used inside the dashboard. */
  login: async () => ({ success: true }),

  logout: async () => {
    clearSession();
    return {
      success: true,
      redirectTo: SIGNED_OUT_PATH,
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

    const payload = decodeJwt(session.token);
    if (!payload) return null;

    const email  = (payload.email as string) ?? "";
    const name   = (payload.user_metadata as Record<string, string>)?.full_name
                ?? (payload.user_metadata as Record<string, string>)?.name
                ?? email.split("@")[0]
                ?? "User";
    const avatar = (payload.user_metadata as Record<string, string>)?.avatar_url ?? null;

    return { id: payload.sub as string, name, email, avatar };
  },

  getPermissions: async () => null,
};
