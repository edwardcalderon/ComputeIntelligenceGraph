"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  buildAuthentikEndSessionUrl,
  revokeAuthentikToken,
  getSupabaseClient,
} from "@cig/auth";

/* ─── Shared auth interface ──────────────────────────────────────────── */

export interface CIGUser {
  email: string;
  name: string;
  avatarUrl?: string;
  sub: string;
  /** Social provider the user signed in with (e.g. "google", "github") */
  socialProvider: string;
}

interface AuthContextValue {
  user: CIGUser | null;
  signOut: () => void;
  /** Which auth backend is active */
  authProvider: "authentik" | "supabase";
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  signOut: () => {},
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

/* ─── Authentik session helpers ──────────────────────────────────────── */

function readAuthentikSession(): CIGUser | null {
  try {
    const token = sessionStorage.getItem("cig_access_token");
    const expiresAt = sessionStorage.getItem("cig_expires_at");
    if (!token) return null;
    if (expiresAt && Date.now() > parseInt(expiresAt, 10)) return null;

    const idToken = sessionStorage.getItem("cig_id_token");
    const payload = decodeJwtPayload(idToken ?? token);
    if (!payload) return null;

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
      socialProvider: socialProvider || "sso",
    };
  } catch {
    return null;
  }
}

function clearAuthentikSession() {
  try {
    sessionStorage.removeItem("cig_access_token");
    sessionStorage.removeItem("cig_id_token");
    sessionStorage.removeItem("cig_refresh_token");
    sessionStorage.removeItem("cig_expires_in");
    sessionStorage.removeItem("cig_expires_at");
    sessionStorage.removeItem("cig_social_provider");
    document.cookie = "cig_has_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  } catch { /* ignore */ }
}

/* ─── Supabase session helpers ──────────────────────────────────────── */

async function readSupabaseSession(): Promise<CIGUser | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const u = session.user;
    return {
      sub:       u.id,
      email:     u.email ?? "",
      name:      u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email?.split("@")[0] ?? "",
      avatarUrl: u.user_metadata?.avatar_url ?? undefined,
      socialProvider: (u.app_metadata?.provider as string) ?? "sso",
    };
  } catch {
    return null;
  }
}

/* ─── Unified Provider ──────────────────────────────────────────────── */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CIGUser | null>(null);

  useEffect(() => {
    if (AUTH_PROVIDER === "authentik") {
      // ── Authentik: read tokens from URL hash or sessionStorage ──
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
            clearAuthentikSession();
            sessionStorage.setItem("cig_access_token", accessToken);
            if (idToken) sessionStorage.setItem("cig_id_token", idToken);
            sessionStorage.setItem("cig_expires_in", String(expiresIn));
            sessionStorage.setItem("cig_expires_at", String(expiresAtMs));
            if (socialProv) sessionStorage.setItem("cig_social_provider", socialProv);
            const expiresAtDate = new Date(expiresAtMs).toUTCString();
            const secure = window.location.protocol === 'https:' ? '; Secure' : '';
            document.cookie = `cig_has_session=1; path=/; expires=${expiresAtDate}; SameSite=Lax${secure}`;
          } catch { /* ignore */ }
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
      setUser(readAuthentikSession());
    } else {
      // ── Supabase: read from Supabase auth ──
      readSupabaseSession().then(setUser);
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            const u = session.user;
            setUser({
              sub:       u.id,
              email:     u.email ?? "",
              name:      u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email?.split("@")[0] ?? "",
              avatarUrl: u.user_metadata?.avatar_url ?? undefined,
              socialProvider: (u.app_metadata?.provider as string) ?? "sso",
            });
          } else {
            setUser(null);
          }
        });
        return () => subscription.unsubscribe();
      }
    }
  }, []);

  const signOut = useCallback(() => {
    let logoutUrl: string | null = null;

    if (AUTH_PROVIDER === "authentik") {
      try {
        const accessToken = sessionStorage.getItem("cig_access_token");
        const idToken = sessionStorage.getItem("cig_id_token");
        if (accessToken) {
          const issuerUrl = process.env.NEXT_PUBLIC_AUTHENTIK_URL ?? "https://auth.cig.technology";
          const clientId  = process.env.NEXT_PUBLIC_AUTHENTIK_CLIENT_ID ?? "G4D6S7WXUoCNZxY7uZSbD08zO3cuXEZwSyUATw2v";
          revokeAuthentikToken({ issuerUrl, clientId, redirectUri: "" }, accessToken).catch(() => {});
        }
        if (idToken) {
          logoutUrl = buildAuthentikEndSessionUrl(
            idToken,
            `${window.location.origin}${window.location.pathname}`,
          );
        }
      } catch { /* ignore */ }
      clearAuthentikSession();
    } else {
      const supabase = getSupabaseClient();
      supabase?.auth.signOut().catch(() => {});
    }
    setUser(null);
    if (logoutUrl) {
      window.location.replace(logoutUrl);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, signOut, authProvider: AUTH_PROVIDER }}>
      {children}
    </AuthContext.Provider>
  );
}
