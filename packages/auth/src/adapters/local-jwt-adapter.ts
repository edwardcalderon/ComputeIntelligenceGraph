import { jwtVerify } from "jose";
import { createSecretKey } from "node:crypto";
import type { AuthAdapter, VerifiedClaims } from "./oidc-adapter";

/**
 * Claims returned after successful local JWT verification.
 * Extends VerifiedClaims with mode: "self-hosted".
 */
export type LocalVerifiedClaims = Omit<VerifiedClaims, "mode"> & {
  mode: "self-hosted";
};

/**
 * Configuration for the local JWT adapter.
 */
export interface LocalJWTAdapterConfig {
  /** The shared HMAC secret — value of CIG_JWT_SECRET */
  secret: string;
}

/**
 * LocalJWTAdapter validates tokens signed with a shared HMAC-SHA256 secret.
 * Used when CIG_AUTH_MODE=self-hosted.
 *
 * Does NOT import or reference Supabase or Authentik.
 */
export class LocalJWTAdapter implements AuthAdapter {
  private readonly config: LocalJWTAdapterConfig;

  constructor(config: LocalJWTAdapterConfig) {
    this.config = config;
  }

  async verifyToken(token: string): Promise<LocalVerifiedClaims> {
    try {
      const secretKey = createSecretKey(Buffer.from(this.config.secret, "utf-8"));

      const { payload } = await jwtVerify(token, secretKey, {
        algorithms: ["HS256"],
      });

      const sub = typeof payload.sub === "string" ? payload.sub : "";
      const email =
        typeof payload["email"] === "string" ? payload["email"] : "";
      const groups = Array.isArray(payload["groups"])
        ? (payload["groups"] as string[])
        : [];
      const tenant =
        typeof payload["tenant"] === "string" ? payload["tenant"] : "";

      return { sub, email, groups, tenant, mode: "self-hosted" };
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
