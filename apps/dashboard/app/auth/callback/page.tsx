"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Receives the Supabase session passed from the landing page via URL hash.
 * Stores the access token in sessionStorage for API calls, then
 * redirects to the intended dashboard route.
 *
 * URL format expected from landing:
 *   /auth/callback?redirect=/graph#access_token=...&refresh_token=...&token_type=bearer&expires_in=3600
 */
export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.slice(1);           // strip leading '#'
    const search = window.location.search.slice(1);       // strip leading '?'

    const hashParams   = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(search);

    const accessToken  = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const expiresIn    = hashParams.get("expires_in");
    const redirect     = searchParams.get("redirect") ?? "/";

    if (accessToken) {
      // Persist session for use in API calls and across page navigations.
      try {
        sessionStorage.setItem("cig_access_token",  accessToken);
        if (refreshToken) sessionStorage.setItem("cig_refresh_token", refreshToken);
        if (expiresIn)    sessionStorage.setItem("cig_expires_in",    expiresIn);
        // Absolute expiry timestamp so the app can check token freshness.
        const expiresAt = Date.now() + (parseInt(expiresIn ?? "3600", 10) * 1000);
        sessionStorage.setItem("cig_expires_at", String(expiresAt));
      } catch {
        // sessionStorage blocked (e.g. private mode with strict settings) — continue anyway.
      }
    }

    // Navigate to the intended feature page (replace so back button goes to landing).
    router.replace(redirect);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4">
        {/* Animated spinner */}
        <div className="relative size-12">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
        </div>
        <p className="text-sm text-cyan-400 animate-pulse tracking-wide">
          Connecting to dashboard…
        </p>
      </div>
    </div>
  );
}
