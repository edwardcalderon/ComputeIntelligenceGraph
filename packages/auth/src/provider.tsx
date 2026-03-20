"use client";

import React, { useState, useEffect } from "react";
import { AuthProvider } from "@edcalderon/auth";
import { SupabaseClient } from "@edcalderon/auth/supabase";
import { getSupabaseClient } from "./client";
import { AuthReadyProvider } from "./auth-ready-context";

/**
 * CIG-configured auth provider. Wraps @edcalderon/auth AuthProvider
 * with a pre-configured Supabase adapter.
 *
 * Gracefully renders children without auth if Supabase env vars are not set
 * (e.g. during static export builds).
 */
export function CIGAuthProvider({ children }: { children: React.ReactNode }) {
  const [authClient, setAuthClient] = useState<SupabaseClient | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (supabase) {
      setAuthClient(new SupabaseClient({ supabase }));
    }
    setReady(true);
  }, []);

  // No Supabase client (missing env vars) — mark ready once the effect has
  // run so consumers don't wait forever, but hasClient=false tells them
  // AuthProvider is NOT in scope and useAuth() must not be called.
  if (!authClient) {
    return (
      <AuthReadyProvider ready={ready} hasClient={false}>
        {children}
      </AuthReadyProvider>
    );
  }

  return (
    <AuthReadyProvider ready={ready} hasClient={true}>
      <AuthProvider client={authClient}>{children}</AuthProvider>
    </AuthReadyProvider>
  );
}
