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

// Server-only utilities (jose / node:crypto) are exported from subpaths
// to avoid bundling Node.js built-ins into client-side static builds:
//   @cig/auth/server  → OIDCAdapter, LocalJWTAdapter, createInternalToken, etc.
// Type-only re-exports are safe — they're erased at compile time.
export type {
  OIDCAdapterConfig,
  AuthAdapter,
  VerifiedClaims,
} from "./adapters/oidc-adapter";
export type { LocalJWTAdapterConfig } from "./adapters/local-jwt-adapter";
export type { InternalTokenPayload } from "./internal-jwt";
