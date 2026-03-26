// CIG-specific auth exports.
export { getSupabaseClient } from "./client";
export { useAuthReady, useAuthAvailable } from "./auth-ready-context";
export { sendEmailOtp, sendMagicLinkEmail, verifyEmailOtp } from "./otp";
export { revokeSessionViaApi } from "./session";

// Authentik PKCE helpers (client-safe)
export {
  buildAuthentikAuthUrl,
  buildAuthentikEndSessionUrl,
  startAuthentikSocialLogin,
  exchangeAuthentikCode,
  revokeAuthentikToken,
} from "./authentik";
export type { AuthentikConfig, AuthentikTokens, AuthentikSocialProvider } from "./authentik";

// Server-only utilities (jose / node:crypto) are exported from @cig/auth/server.
// Do NOT re-export types from those modules here — webpack resolves
// the source files before TypeScript type erasure, pulling in node:crypto.
