/**
 * OIDC token verification middleware using JWKS.
 *
 * Validates ID tokens against the Authentik JWKS endpoint using the `jose` library.
 * Falls back to local JWT verification when CIG_AUTH_MODE !== 'managed'.
 *
 * Phase 0.2: Authentik Auth Hardening
 */

import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const AUTHENTIK_JWKS_URI = process.env['AUTHENTIK_JWKS_URI'] ?? '';
const AUTHENTIK_ISSUER_URL = process.env['AUTHENTIK_ISSUER_URL'] ?? '';
const OIDC_CLIENT_ID = process.env['OIDC_CLIENT_ID'] ?? '';

// ---------------------------------------------------------------------------
// Lazy-initialised JWKS key set
// ---------------------------------------------------------------------------

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    if (!AUTHENTIK_JWKS_URI) {
      throw new Error('AUTHENTIK_JWKS_URI is not configured');
    }
    jwks = createRemoteJWKSet(new URL(AUTHENTIK_JWKS_URI));
  }
  return jwks;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface OIDCVerifiedPayload {
  sub: string;
  email: string;
  groups: string[];
  [key: string]: unknown;
}

/**
 * Verify an ID token against the Authentik JWKS endpoint.
 * Returns the decoded payload with `sub`, `email`, and `groups` claims.
 * Throws on invalid, expired, or malformed tokens.
 */
export async function verifyIdToken(idToken: string): Promise<OIDCVerifiedPayload> {
  const keySet = getJWKS();

  const verifyOptions: { issuer?: string; audience?: string } = {};
  if (AUTHENTIK_ISSUER_URL) {
    verifyOptions.issuer = AUTHENTIK_ISSUER_URL;
  }
  if (OIDC_CLIENT_ID) {
    verifyOptions.audience = OIDC_CLIENT_ID;
  }

  const { payload } = await jwtVerify(idToken, keySet, verifyOptions);

  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof (payload as JWTPayload & { email?: string }).email === 'string'
    ? (payload as JWTPayload & { email?: string }).email!
    : '';
  const groups = Array.isArray((payload as JWTPayload & { groups?: string[] }).groups)
    ? (payload as JWTPayload & { groups?: string[] }).groups!
    : [];

  return { ...payload, sub, email, groups };
}

/**
 * Reset the cached JWKS (useful for testing).
 */
export function resetJWKSCache(): void {
  jwks = null;
}
