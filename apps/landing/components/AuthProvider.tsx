"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { getSupabaseClient, revokeSessionViaApi } from "@cig/auth";
import { clearPendingDashboardRedirect } from "../lib/dashboardHandoff";

/* ─── Shared auth interface ──────────────────────────────────────────── */

export interface CIGUser {
  email: string;
  name: string;
  avatarUrl?: string;
  sub: string;
  /** Which auth backend created the session */
  authSource: "authentik" | "supabase";
  /** Social provider the user signed in with (e.g. "google", "github") */
  socialProvider: string;
}

interface AuthContextValue {
  user: CIGUser | null;
  signOut: () => void;
  isHydrated: boolean;
  isSigningOut: boolean;
  /** Which auth backend is active */
  authProvider: "authentik" | "supabase";
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  signOut: () => {},
  isHydrated: false,
  isSigningOut: false,
  authProvider: "authentik",
});

export function useCIGAuth() {
  return useContext(AuthContext);
}

/** Env flag: set NEXT_PUBLIC_AUTH_PROVIDER=supabase to fall back to Supabase auth */
const AUTH_PROVIDER: "authentik" | "supabase" =
  (process.env.NEXT_PUBLIC_AUTH_PROVIDER as "authentik" | "supabase") || "authentik";

/* ─── JWT helpers ────────────────────────────────────────────────────── */

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function looksLikeSupabaseIssuer(issuer: string): boolean {
  const normalized = issuer.toLowerCase();
  return normalized.includes("supabase") || normalized.includes("/auth/v1");
}

/* ─── Authentik session helpers ──────────────────────────────────────── */

function readAuthentikSession(): CIGUser | null {
  try {
    const authSource = sessionStorage.getItem("cig_auth_source");
    if (authSource === "supabase") {
      return null;
    }

    const token = sessionStorage.getItem("cig_access_token");
    const expiresAt = sessionStorage.getItem("cig_expires_at");
    if (!token) return null;
    if (expiresAt && Date.now() > parseInt(expiresAt, 10)) return null;

    const idToken = sessionStorage.getItem("cig_id_token");
    const payload = decodeJwtPayload(idToken ?? token);
    if (!payload) return null;

    const issuer = typeof payload.iss === "string" ? payload.iss.trim() : "";
    if (issuer && looksLikeSupabaseIssuer(issuer)) {
      return null;
    }

    const email = (payload.email as string) ?? "";
    const avatarUrl = (payload.picture as string) ?? undefined;

    // Detect which social provider was used:
    // 1. Stored explicitly during startAuthentikSocialLogin
    // 2. Inferred from avatar URL pattern
    let socialProvider = sessionStorage.getItem("cig_social_provider") ?? "";
    if (!socialProvider && avatarUrl) {
      if (avatarUrl.includes("googleusercontent.com")) socialProvider = "google";
      else if (avatarUrl.includes("githubusercontent.com")) socialProvider = "github";
    }

    return {
      sub:       (payload.sub as string) ?? "",
      email,
      name:      (payload.name as string) ?? (payload.preferred_username as string) ?? email.split("@")[0] ?? "",
      avatarUrl,
      authSource: "authentik",
      socialProvider: socialProvider || "sso",
    };
  } catch {
    return null;
  }
}

function clearLandingBrowserSession() {
  try {
    sessionStorage.removeItem("cig_access_token");
    sessionStorage.removeItem("cig_id_token");
    sessionStorage.removeItem("cig_refresh_token");
    sessionStorage.removeItem("cig_expires_in");
    sessionStorage.removeItem("cig_expires_at");
    sessionStorage.removeItem("cig_auth_source");
    sessionStorage.removeItem("cig_social_provider");
    document.cookie = "cig_has_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  } catch { /* ignore */ }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : "";
    if (projectRef) {
      localStorage.removeItem(`sb-${projectRef}-auth-token`);
    }
    localStorage.removeItem("supabase.auth.token");
  } catch {
    /* ignore */
  }
}

function persistAuthSource(source: "authentik" | "supabase") {
  try {
    sessionStorage.setItem("cig_auth_source", source);
  } catch {
    // Ignore storage failures in private browsing modes.
  }
}

function getLandingLoggedOutUrl(): string {
  return `${window.location.origin}?logged_out=1`;
}

/* ─── Supabase session helpers ──────────────────────────────────────── */

async function readSupabaseSession(): Promise<CIGUser | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const u = session.user;
    const detectedProvider =
      (u.app_metadata?.provider as string) ||
      (Array.isArray((u as any).identities) && (u as any).identities[0]?.provider) ||
      (u.email ? "email" : "sso");
    return {
      sub:       u.id,
      email:     u.email ?? "",
      name:      u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email?.split("@")[0] ?? "",
      avatarUrl: u.user_metadata?.avatar_url ?? undefined,
      authSource: "supabase",
      socialProvider: detectedProvider,
    };
  } catch {
    return null;
  }
}

/* ─── Unified Provider ──────────────────────────────────────────────── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<{
    user: CIGUser | null;
    isHydrated: boolean;
    isSigningOut: boolean;
  }>({
    user: null,
    isHydrated: false,
    isSigningOut: false,
  });
  // Monotonic refresh token so an older async session read cannot overwrite
  // a newer OTP/login/logout transition.
  const refreshGenerationRef = useRef(0);

  const invalidatePendingRefreshes = useCallback(() => {
    refreshGenerationRef.current += 1;
  }, []);

  const reconcileAuthState = useCallback(async () => {
    const generation = ++refreshGenerationRef.current;
    const supabaseUser = await readSupabaseSession();
    
    // Bail if a newer reconciliation started (login/logout happened during async)
    if (generation !== refreshGenerationRef.current) {
      return;
    }

    if (supabaseUser) {
      // Supabase user takes precedence
      persistAuthSource("supabase");
      setAuthState({
        user: supabaseUser,
        isHydrated: true,
        isSigningOut: false,
      });
      return;
    }

    const localUser = readAuthentikSession();
    if (localUser) {
      persistAuthSource("authentik");
      setAuthState({
        user: localUser,
        isHydrated: true,
        isSigningOut: false,
      });
    } else {
      // No user anywhere - mark as hydrated (logged out state)
      setAuthState({
        user: null,
        isHydrated: true,
        isSigningOut: false,
      });
    }
    // If we have localUser but no supabaseUser, keep the localUser state set above
  }, []);

  useEffect(() => {
    // 1) Handle Authentik logout return
    const params = new URLSearchParams(window.location.search);
    const isLoggedOutReturn = params.get("logged_out") === "1";
    if (isLoggedOutReturn) {
      invalidatePendingRefreshes();
      clearLandingBrowserSession();
      clearPendingDashboardRedirect();
      window.history.replaceState({}, "", window.location.pathname);
      setAuthState({ user: null, isHydrated: true, isSigningOut: false });
    }

    // 2) Process Authentik hash tokens if present
    const hash = window.location.hash.slice(1);
    if (hash) {
      const hp = new URLSearchParams(hash);
      const accessToken = hp.get("access_token");
      if (accessToken) {
        const idToken    = hp.get("id_token") ?? undefined;
        const expiresIn  = parseInt(hp.get("expires_in") ?? "3600", 10);
        const expiresAtMs = Date.now() + expiresIn * 1000;
        const socialProv = hp.get("social_provider") ?? undefined;
        try {
          clearLandingBrowserSession();
          sessionStorage.setItem("cig_access_token", accessToken);
          if (idToken) sessionStorage.setItem("cig_id_token", idToken);
          sessionStorage.setItem("cig_expires_in", String(expiresIn));
          sessionStorage.setItem("cig_expires_at", String(expiresAtMs));
          sessionStorage.setItem("cig_auth_source", "authentik");
          if (socialProv) sessionStorage.setItem("cig_social_provider", socialProv);
          const expiresAtDate = new Date(expiresAtMs).toUTCString();
          const secure = window.location.protocol === 'https:' ? '; Secure' : '';
          document.cookie = `cig_has_session=1; path=/; expires=${expiresAtDate}; SameSite=Lax${secure}`;
        } catch { /* ignore */ }
        window.history.replaceState({}, "", window.location.pathname);
      }
    }

    // 3) Resolve the current user. Authentik/OTP sessions are available
    // synchronously in sessionStorage, while Supabase may need an async read.
    if (!isLoggedOutReturn) {
      void reconcileAuthState();
    }

    // 4) Subscribe to Supabase changes even in Authentik mode (hybrid)
    const supabase = getSupabaseClient();
    let unsub: (() => void) | undefined;

    const onSessionChanged = () => {
      void reconcileAuthState();
    };
    const onWindowResume = () => {
      void reconcileAuthState();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void reconcileAuthState();
      }
    };

    window.addEventListener("cig-session-changed", onSessionChanged);
    window.addEventListener("focus", onWindowResume);
    window.addEventListener("pageshow", onWindowResume);
    document.addEventListener("visibilitychange", onVisibilityChange);

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          persistAuthSource("supabase");
          const u = session.user;
          const detectedProvider =
            (u.app_metadata?.provider as string) ||
            (Array.isArray((u as any).identities) && (u as any).identities[0]?.provider) ||
            (u.email ? "email" : "sso");
          setAuthState({
            user: {
              sub: u.id,
              email: u.email ?? "",
              name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email?.split("@")[0] ?? "",
              avatarUrl: u.user_metadata?.avatar_url ?? undefined,
              authSource: "supabase",
              socialProvider: detectedProvider,
            },
            isHydrated: true,
            isSigningOut: false,
          });
        } else {
          void reconcileAuthState();
        }
      });
      unsub = () => subscription.unsubscribe();
    }

    return () => {
      unsub?.();
      window.removeEventListener("cig-session-changed", onSessionChanged);
      window.removeEventListener("focus", onWindowResume);
      window.removeEventListener("pageshow", onWindowResume);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [invalidatePendingRefreshes, reconcileAuthState]);

  const signOut = useCallback(() => {
    invalidatePendingRefreshes();
    const sessionSource = (() => {
      try {
        return (sessionStorage.getItem("cig_auth_source") as "authentik" | "supabase" | null) ?? authState.user?.authSource ?? null;
      } catch {
        return authState.user?.authSource ?? null;
      }
    })();
    const loggedOutUrl = getLandingLoggedOutUrl();
    const accessToken = sessionStorage.getItem("cig_access_token") ?? undefined;

    if (sessionSource === "supabase") {
      const supabase = getSupabaseClient();
      void (async () => {
        try {
          // Supabase email sessions do not need the hosted end-session flow.
          // Keep logout local so we do not redirect into Supabase's OIDC
          // logout endpoint, which expects an API key on the request.
          await supabase?.auth.signOut({ scope: "local" });
        } catch { /* ignore */ }
        clearLandingBrowserSession();
        clearPendingDashboardRedirect();
        setAuthState({ user: null, isHydrated: true, isSigningOut: false });
        window.location.replace(loggedOutUrl);
      })();
      return;
    }

    clearLandingBrowserSession();
    clearPendingDashboardRedirect();
    setAuthState({
      user: null,
      isHydrated: true,
      isSigningOut: true,
    });

    void revokeSessionViaApi(accessToken);
    try {
      window.location.replace(loggedOutUrl);
    } catch {
      window.location.replace(window.location.origin);
    }
  }, [authState.user?.authSource, invalidatePendingRefreshes]);

  return (
    <AuthContext.Provider
      value={{
        user: authState.user,
        signOut,
        isHydrated: authState.isHydrated,
        isSigningOut: authState.isSigningOut,
        authProvider: AUTH_PROVIDER,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
