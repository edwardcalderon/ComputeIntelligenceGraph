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

// Auth adapter factory
export { createAuthAdapter } from "./create-auth-adapter";
export type { AuthMode } from "./create-auth-adapter";

// OIDC adapter
export { OIDCAdapter } from "./adapters/oidc-adapter";
export type {
  OIDCAdapterConfig,
  AuthAdapter,
  VerifiedClaims,
} from "./adapters/oidc-adapter";

// Local JWT adapter
export { LocalJWTAdapter } from "./adapters/local-jwt-adapter";
export type { LocalJWTAdapterConfig } from "./adapters/local-jwt-adapter";

// Internal JWT helpers
export { createInternalToken, verifyInternalToken } from "./internal-jwt";
export type { InternalTokenPayload } from "./internal-jwt";
