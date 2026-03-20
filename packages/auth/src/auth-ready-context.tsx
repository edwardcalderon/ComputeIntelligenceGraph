"use client";

import React, { createContext, useContext } from "react";

interface AuthReadyState {
  /** Initialization has finished (useEffect has run). */
  ready: boolean;
  /** An AuthProvider is actually in scope — safe to call useAuth(). */
  hasClient: boolean;
}

const AuthReadyContext = createContext<AuthReadyState>({
  ready: false,
  hasClient: false,
});

export function AuthReadyProvider({
  ready,
  hasClient,
  children,
}: {
  ready: boolean;
  hasClient: boolean;
  children: React.ReactNode;
}) {
  return (
    <AuthReadyContext.Provider value={{ ready, hasClient }}>
      {children}
    </AuthReadyContext.Provider>
  );
}

/** Returns true once auth initialization has finished. */
export function useAuthReady(): boolean {
  return useContext(AuthReadyContext).ready;
}

/** Returns true when AuthProvider is in scope and useAuth() is safe to call. */
export function useAuthAvailable(): boolean {
  return useContext(AuthReadyContext).hasClient;
}
