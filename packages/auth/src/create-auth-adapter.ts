import type { AuthAdapter, OIDCAdapterConfig } from "./adapters/oidc-adapter";
import type { LocalJWTAdapterConfig } from "./adapters/local-jwt-adapter";

export type AuthMode = "managed" | "self-hosted";

/**
 * Factory that returns the correct AuthAdapter for the given mode.
 *
 * - "managed"     → OIDCAdapter (validates against Authentik JWKS)
 * - "self-hosted" → LocalJWTAdapter (validates against CIG_JWT_SECRET)
 *
 * Adapters are loaded via dynamic require so that neither Supabase nor
 * Authentik dependencies are imported when they are not needed.
 */
export function createAuthAdapter(
  mode: AuthMode,
  config: OIDCAdapterConfig | LocalJWTAdapterConfig
): AuthAdapter {
  if (mode === "managed") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OIDCAdapter } = require("./adapters/oidc-adapter") as typeof import("./adapters/oidc-adapter");
    return new OIDCAdapter(config as OIDCAdapterConfig);
  }

  if (mode === "self-hosted") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LocalJWTAdapter } = require("./adapters/local-jwt-adapter") as typeof import("./adapters/local-jwt-adapter");
    return new LocalJWTAdapter(config as LocalJWTAdapterConfig);
  }

  throw new Error(`Unknown auth mode: ${mode as string}`);
}
