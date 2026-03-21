import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Claims shared by all successful token verification flows.
 */
export interface BaseVerifiedClaims {
  sub: string;
  email: string;
  groups: string[];
  tenant: string;
}

/**
 * Claims returned after successful managed token verification.
 */
export interface ManagedVerifiedClaims extends BaseVerifiedClaims {
  mode: "managed";
}

/**
 * Claims returned after successful self-hosted token verification.
 */
export interface SelfHostedVerifiedClaims extends BaseVerifiedClaims {
  mode: "self-hosted";
}

/**
 * Claims returned after successful token verification.
 */
export type VerifiedClaims =
  | ManagedVerifiedClaims
  | SelfHostedVerifiedClaims;

/**
 * Configuration for the OIDC adapter.
 */
export interface OIDCAdapterConfig {
  /** Authentik issuer URL (e.g. https://auth.example.com/application/o/cig/) */
  issuerUrl: string;
  /** OIDC client ID registered in Authentik */
  clientId: string;
  /** JWKS endpoint URI (e.g. https://auth.example.com/application/o/cig/jwks/) */
  jwksUri: string;
}

/**
 * Auth adapter interface — the single contract all adapters must satisfy.
 */
export interface AuthAdapter {
  verifyToken(token: string): Promise<VerifiedClaims>;
}

/**
 * OIDCAdapter validates ID tokens issued by Authentik using the JWKS endpoint.
 * Used when CIG_AUTH_MODE=managed.
 */
export class OIDCAdapter implements AuthAdapter {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly config: OIDCAdapterConfig;

  constructor(config: OIDCAdapterConfig) {
    this.config = config;
    this.jwks = createRemoteJWKSet(new URL(config.jwksUri));
  }

  async verifyToken(token: string): Promise<ManagedVerifiedClaims> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.config.issuerUrl,
        audience: this.config.clientId,
      });

      const sub = typeof payload.sub === "string" ? payload.sub : "";
      const email =
        typeof payload["email"] === "string" ? payload["email"] : "";
      const groups = Array.isArray(payload["groups"])
        ? (payload["groups"] as string[])
        : [];
      const tenant =
        typeof payload["tenant"] === "string" ? payload["tenant"] : "";

      return { sub, email, groups, tenant, mode: "managed" };
    } catch (err) {
      // Use error code check instead of instanceof to avoid ESM/CJS module
      // boundary issues where the same class from different module instances
      // fails instanceof checks.
      const errCode = (err as NodeJS.ErrnoException).code;

      if (errCode === "ERR_JWT_EXPIRED") {
        const expiredError = new Error("Token has expired");
        (expiredError as NodeJS.ErrnoException).code = "token_expired";
        throw expiredError;
      }

      // Covers JWSSignatureVerificationFailed, JWSInvalid, JWTClaimValidationFailed, etc.
      const invalidError = new Error("Token is invalid");
      (invalidError as NodeJS.ErrnoException).code = "token_invalid";
      throw invalidError;
    }
  }
}
