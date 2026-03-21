/**
 * Server-only exports that depend on jose / node:crypto.
 *
 * Import from "@cig/auth/server" in Node.js contexts (API routes,
 * middleware, CLI). Never import this from client-side code or
 * static-export Next.js builds.
 */

// Auth adapter factory
export { createAuthAdapter } from "./create-auth-adapter";
export type { AuthMode } from "./create-auth-adapter";

export { OIDCAdapter } from "./adapters/oidc-adapter";
export type {
  BaseVerifiedClaims,
  OIDCAdapterConfig,
  AuthAdapter,
  ManagedVerifiedClaims,
  SelfHostedVerifiedClaims,
  VerifiedClaims,
} from "./adapters/oidc-adapter";

export { LocalJWTAdapter } from "./adapters/local-jwt-adapter";
export type {
  LocalJWTAdapterConfig,
  LocalVerifiedClaims,
} from "./adapters/local-jwt-adapter";

export { createInternalToken, verifyInternalToken } from "./internal-jwt";
export type { InternalTokenPayload } from "./internal-jwt";
