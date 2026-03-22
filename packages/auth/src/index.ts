// Core exports from @edcalderon/auth
export { useAuth, AuthProvider } from "@edcalderon/auth";
export type {
  User,
  AuthClient,
  SignInOptions,
  OAuthFlow,
  AuthRuntime,
  AuthCapabilities,
} from "@edcalderon/auth";

// Supabase adapter re-export
export { SupabaseClient } from "@edcalderon/auth/supabase";

// CIG-specific exports
export { CIGAuthProvider } from "./provider";
export { getSupabaseClient } from "./client";
export { useAuthReady, useAuthAvailable } from "./auth-ready-context";
export { sendEmailOtp, verifyEmailOtp } from "./otp";

// Authentik PKCE helpers (client-safe)
export {
  buildAuthentikAuthUrl,
  startAuthentikSocialLogin,
  exchangeAuthentikCode,
  revokeAuthentikToken,
} from "./authentik";
export type { AuthentikConfig, AuthentikTokens, AuthentikSocialProvider } from "./authentik";

// Server-only utilities (jose / node:crypto) are exported from @cig/auth/server.
// Do NOT re-export types from those modules here — webpack resolves
// the source files before TypeScript type erasure, pulling in node:crypto.
