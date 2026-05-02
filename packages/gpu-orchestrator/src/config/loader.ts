/**
 * Configuration loader for the GPU Orchestrator.
 *
 * Reads `GPU_ORCH_*` environment variables, strips the prefix, maps keys
 * to the Zod schema fields, validates with Zod, and returns a typed
 * `OrchestratorConfig`. On validation failure the process exits with a
 * descriptive list of **all** validation errors.
 *
 * @module
 */

import {
  ConfigSchema,
  ENV_KEY_MAP,
  SENSITIVE_FIELDS,
  type OrchestratorConfig,
} from './schemas.js';
import { ConfigError } from '../lib/errors.js';

/** Prefix stripped from environment variable names before key mapping. */
const ENV_PREFIX = 'GPU_ORCH_';

/**
 * Collect all `GPU_ORCH_*` environment variables, strip the prefix, and
 * map the remaining suffix to the corresponding `ConfigSchema` field name.
 *
 * Unknown suffixes (no mapping entry) are silently ignored.
 */
function collectEnvValues(
  env: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const raw: Record<string, string> = {};

  for (const [envKey, envValue] of Object.entries(env)) {
    if (!envKey.startsWith(ENV_PREFIX) || envValue === undefined) {
      continue;
    }

    const suffix = envKey.slice(ENV_PREFIX.length);
    const configKey = ENV_KEY_MAP[suffix];

    if (configKey !== undefined) {
      raw[configKey] = envValue;
    }
  }

  return raw;
}

/**
 * Load and validate the orchestrator configuration from `GPU_ORCH_*`
 * environment variables.
 *
 * @param env - Optional environment record (defaults to `process.env`).
 *              Useful for testing without mutating the real environment.
 * @returns A fully validated `OrchestratorConfig`.
 * @throws {ConfigError} When one or more validation errors are detected.
 *         The error message contains **all** validation issues.
 */
export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): OrchestratorConfig {
  const raw = collectEnvValues(env);

  const result = ConfigSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `  • ${issue.path.join('.')}: ${issue.message}`,
    );

    throw new ConfigError(
      `Configuration validation failed:\n${issues.join('\n')}`,
      { component: 'ConfigLoader', operation: 'loadConfig' },
    );
  }

  return result.data;
}

/**
 * Return a shallow copy of the configuration with sensitive field values
 * replaced by `'***'`.
 *
 * Non-sensitive fields are converted to their string representation so the
 * result is safe for logging. Sensitive fields always appear as `'***'`
 * even when their value is `undefined`.
 */
export function redactConfig(
  config: OrchestratorConfig,
): Record<string, string> {
  const redacted: Record<string, string> = {};

  // First, ensure all sensitive fields are always present as '***'
  for (const field of SENSITIVE_FIELDS) {
    redacted[field] = '***';
  }

  // Then process all defined fields
  for (const [key, value] of Object.entries(config)) {
    if (SENSITIVE_FIELDS.includes(key as keyof OrchestratorConfig)) {
      // Already set above — keep as '***'
      continue;
    } else if (Array.isArray(value)) {
      redacted[key] = value.join(',');
    } else {
      redacted[key] = String(value);
    }
  }

  return redacted;
}
