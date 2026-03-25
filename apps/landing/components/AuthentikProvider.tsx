"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { revokeSessionViaApi } from "@cig/auth";

interface AuthentikUser {
  email: string;
  name: string;
  avatarUrl?: string;
  sub: string;
}

interface AuthentikContextValue {
  user: AuthentikUser | null;
  signOut: () => void;
}

const AuthentikContext = createContext<AuthentikContextValue>({
  user: null,
  signOut: () => {},
});

export function useAuthentikUser() {
  return useContext(AuthentikContext);
}

/** Decode JWT payload without verification (for display only). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function readSessionFromStorage(): AuthentikUser | null {
  try {
    const token = sessionStorage.getItem("cig_access_token");
    const expiresAt = sessionStorage.getItem("cig_expires_at");
    if (!token) return null;
    if (expiresAt && Date.now() > parseInt(expiresAt, 10)) return null;

    // Prefer id_token (has full OIDC claims: email, name, picture).
    const idToken = sessionStorage.getItem("cig_id_token");
    const payload = decodeJwtPayload(idToken ?? token);
    if (!payload) return null;

    const email = (payload.email as string) ?? "";
    return {
      sub:       (payload.sub as string) ?? "",
      email,
      name:      (payload.name as string) ?? (payload.preferred_username as string) ?? email.split("@")[0] ?? "",
      avatarUrl: (payload.picture as string) ?? undefined,
    };
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
    document.cookie = "cig_has_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  } catch { /* ignore */ }
}

export function AuthentikProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthentikUser | null>(null);

  // On mount: check for tokens in the URL hash (redirected from dashboard callback)
  // or read from sessionStorage (returning user).
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const hp = new URLSearchParams(hash);
      const accessToken = hp.get("access_token");
      if (accessToken) {
        const idToken    = hp.get("id_token") ?? undefined;
        const expiresIn  = parseInt(hp.get("expires_in") ?? "3600", 10);
        const expiresAtMs = Date.now() + expiresIn * 1000;
        try {
          // Clear stale session before storing new tokens — prevents showing
          // the previous user's info if the new id_token is absent.
          clearSession();
          sessionStorage.setItem("cig_access_token", accessToken);
          if (idToken) sessionStorage.setItem("cig_id_token", idToken);
          sessionStorage.setItem("cig_expires_in", String(expiresIn));
          sessionStorage.setItem("cig_expires_at", String(expiresAtMs));
          const expiresAtDate = new Date(expiresAtMs).toUTCString();
          document.cookie = `cig_has_session=1; path=/; expires=${expiresAtDate}; SameSite=Lax`;
        } catch { /* ignore */ }
        // Clean the hash from the URL
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
    setUser(readSessionFromStorage());
  }, []);

  const signOut = () => {
    // Revoke token in background (best-effort)
    try {
      const token = sessionStorage.getItem("cig_access_token");
      if (token) {
        revokeSessionViaApi(token).catch(() => {});
      }
    } catch { /* ignore */ }

    clearSession();
    setUser(null);
  };

  return (
    <AuthentikContext.Provider value={{ user, signOut }}>
      {children}
    </AuthentikContext.Provider>
  );
}
