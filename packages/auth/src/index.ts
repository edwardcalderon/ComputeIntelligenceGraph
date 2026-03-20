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
