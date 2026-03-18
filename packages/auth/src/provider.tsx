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

  if (!authClient) {
    return (
      <AuthReadyProvider ready={false}>{children}</AuthReadyProvider>
    );
  }

  return (
    <AuthReadyProvider ready={ready}>
      <AuthProvider client={authClient}>{children}</AuthProvider>
    </AuthReadyProvider>
  );
}
