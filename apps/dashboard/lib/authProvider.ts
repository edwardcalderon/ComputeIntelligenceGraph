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

const LANDING_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://cig.lat";

export const authProvider: AuthProvider = {
  /** Not used — auth happens on the landing page. */
  login: async () => ({ success: true }),

  logout: async () => {
    clearSession();
    return {
      success: true,
      redirectTo: LANDING_URL,
    };
  },

  check: async () => {
    const session = getSession();
    if (session) return { authenticated: true };
    return {
      authenticated: false,
      redirectTo: LANDING_URL,
      error: { name: "Unauthenticated", message: "No active session." },
    };
  },

  onError: async (error) => {
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) {
      clearSession();
      return { logout: true, redirectTo: LANDING_URL };
    }
    return { error };
  },

  getIdentity: async () => {
    const session = getSession();
    if (!session) return null;

    const payload = decodeJwt(session.token);
    if (!payload) return null;

    const email = (payload.email as string) ?? "";
    const name  = (payload.user_metadata as Record<string, string>)?.full_name
               ?? (payload.user_metadata as Record<string, string>)?.name
               ?? email.split("@")[0]
               ?? "User";
    const avatar = (payload.user_metadata as Record<string, string>)?.avatar_url ?? null;

    return {
      id:     payload.sub as string,
      name,
      email,
      avatar,
    };
  },

  getPermissions: async () => null,
};
