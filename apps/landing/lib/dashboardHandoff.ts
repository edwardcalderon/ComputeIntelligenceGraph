"use client";

import { getSupabaseClient } from "@cig/auth";
import {
  isProtectedDashboardHostname,
  normalizeDashboardRedirectPath,
} from "@cig/ui/siteUrl";

const PENDING_DASHBOARD_REDIRECT_KEY = "cig_pending_dashboard_redirect";
const PENDING_DASHBOARD_AUTH_INTENT_KEY = "cig_pending_dashboard_auth_intent";
const AUTH_PROVIDER = process.env.NEXT_PUBLIC_AUTH_PROVIDER || "authentik";
const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

function readStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function persistPendingDashboardRedirect(path: string): void {
  const storage = readStorage();
  if (!storage) {
    return;
  }

  storage.setItem(
    PENDING_DASHBOARD_REDIRECT_KEY,
    normalizeDashboardRedirectPath(path, "/"),
  );
  storage.setItem(PENDING_DASHBOARD_AUTH_INTENT_KEY, "1");
}

export function readPendingDashboardRedirect(): string | null {
  const storage = readStorage();
  if (!storage) {
    return null;
  }

  return normalizeDashboardRedirectPath(
    storage.getItem(PENDING_DASHBOARD_REDIRECT_KEY),
    "/",
  );
}

export function clearPendingDashboardRedirect(): void {
  const storage = readStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(PENDING_DASHBOARD_REDIRECT_KEY);
  storage.removeItem(PENDING_DASHBOARD_AUTH_INTENT_KEY);
}

function hasPendingDashboardAuthIntent(): boolean {
  const storage = readStorage();
  if (!storage) {
    return false;
  }

  return storage.getItem(PENDING_DASHBOARD_AUTH_INTENT_KEY) === "1";
}

export function consumePendingDashboardRedirect(): string | null {
  if (!hasPendingDashboardAuthIntent()) {
    clearPendingDashboardRedirect();
    return null;
  }

  const target = readPendingDashboardRedirect();
  clearPendingDashboardRedirect();
  return target;
}

export function resolveDashboardRedirectFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const requested = normalizeDashboardRedirectPath(
    params.get("dashboard_redirect"),
    "/",
  );
  return requested || "/";
}

export function cleanLandingAuthSearchParams(): void {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("auth");
  url.searchParams.delete("dashboard_redirect");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export async function goToDashboard(path = "/"): Promise<void> {
  const normalizedPath = normalizeDashboardRedirectPath(path, "/");
  clearPendingDashboardRedirect();
  const dashboardHostname = (() => {
    try {
      return new URL(DASHBOARD_URL).hostname;
    } catch {
      return "";
    }
  })();
  const requiresProtectedHandoff = isProtectedDashboardHostname(dashboardHostname);

  if (AUTH_PROVIDER === "supabase") {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const hash = new URLSearchParams({
            access_token: session.access_token,
            refresh_token: session.refresh_token ?? "",
            token_type: "bearer",
            expires_in: String(session.expires_in ?? 3600),
            auth_source: "supabase",
          }).toString();
          window.location.replace(
            `${DASHBOARD_URL}/auth/callback?redirect=${encodeURIComponent(normalizedPath)}#${hash}`,
          );
          return;
        }
      }
    } catch {
      // fall through to a guarded redirect decision
    }
  } else {
    try {
      const accessToken = sessionStorage.getItem("cig_access_token");
      if (accessToken) {
        const idToken = sessionStorage.getItem("cig_id_token") ?? "";
        const expiresIn = sessionStorage.getItem("cig_expires_in") ?? "3600";
        const hash = new URLSearchParams({
          access_token: accessToken,
          ...(idToken && { id_token: idToken }),
          expires_in: expiresIn,
          auth_source: "authentik",
        }).toString();
        window.location.replace(
          `${DASHBOARD_URL}/auth/callback?redirect=${encodeURIComponent(normalizedPath)}#${hash}`,
        );
        return;
      }
    } catch {
      // fall through to a guarded redirect decision
    }
  }

  if (requiresProtectedHandoff) {
    throw new Error("Protected dashboard access requires an authenticated handoff.");
  }

  window.location.replace(`${DASHBOARD_URL}${normalizedPath}`);
}
