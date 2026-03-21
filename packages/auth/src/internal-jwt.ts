import { createHmac } from "node:crypto";
import { createSecretKey } from "node:crypto";
import { jwtVerify } from "jose";

/**
 * Payload returned by verifyInternalToken.
 */
export interface InternalTokenPayload {
  iss: string;
  sub: string;
  exp: number;
}

const ISSUER = "cig-internal";
const TTL_SECONDS = 5 * 60; // 5 minutes

/**
 * Creates a short-lived internal service-to-service JWT.
 *
 * Signs { iss: "cig-internal", sub: serviceName, exp: now+5min } with HMAC-SHA256.
 * Does NOT require any network calls or external identity provider.
 */
export function createInternalToken(serviceName: string, secret: string): string {
  const now = Math.floor(Date.now() / 1000);

  // jose's SignJWT.sign() is async, so we build the token synchronously using
  // Node's built-in crypto to keep the public API synchronous as specified in
  // the design.
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: ISSUER, sub: serviceName, exp: now + TTL_SECONDS, iat: now })
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", Buffer.from(secret, "utf-8"))
    .update(signingInput)
    .digest("base64url");

  return `${signingInput}.${signature}`;
}

/**
 * Verifies an internal JWT and returns its payload.
 *
 * Throws if:
 * - iss !== "cig-internal"
 * - token is expired
 * - signature is invalid
 */
export async function verifyInternalToken(
  token: string,
  secret: string
): Promise<InternalTokenPayload> {
  const secretKey = createSecretKey(Buffer.from(secret, "utf-8"));

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
      issuer: ISSUER,
    });

    if (payload.iss !== ISSUER) {
      const err = new Error(`Invalid issuer: expected "${ISSUER}", got "${payload.iss}"`);
      (err as NodeJS.ErrnoException).code = "invalid_issuer";
      throw err;
    }

    return {
      iss: payload.iss as string,
      sub: typeof payload.sub === "string" ? payload.sub : "",
      exp: typeof payload.exp === "number" ? payload.exp : 0,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "invalid_issuer") {
      throw err;
    }

    // Use error code check instead of instanceof to avoid ESM/CJS module
    // boundary issues where the same class from different module instances
    // fails instanceof checks.
    const errCode = (err as NodeJS.ErrnoException).code;

    if (errCode === "ERR_JWT_EXPIRED") {
      const expiredError = new Error("Internal token has expired");
      (expiredError as NodeJS.ErrnoException).code = "token_expired";
      throw expiredError;
    }

    // JWSSignatureVerificationFailed, JWSInvalid, issuer mismatch from jose, etc.
    const invalidError = new Error("Internal token is invalid");
    (invalidError as NodeJS.ErrnoException).code = "token_invalid";
    throw invalidError;
  }
}
