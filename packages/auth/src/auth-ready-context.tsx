"use client";

import React, { createContext, useContext } from "react";

/**
 * Context that tracks whether the CIG auth provider is mounted and ready.
 * Used by useSafeAuth to avoid throwing when AuthProvider isn't available.
 */
const AuthReadyContext = createContext(false);

export function AuthReadyProvider({
  ready,
  children,
}: {
  ready: boolean;
  children: React.ReactNode;
}) {
  return (
    <AuthReadyContext.Provider value={ready}>
      {children}
    </AuthReadyContext.Provider>
  );
}

export function useAuthReady(): boolean {
  return useContext(AuthReadyContext);
}
