/**
 * Provider factory for the GPU Orchestrator.
 *
 * Creates the correct {@link ComputeProvider} implementation based on the
 * `provider` field in the orchestrator configuration. New providers can be
 * added here without modifying {@link SessionManager} or {@link HealthMonitor}.
 *
 * @module
 */

import type { Logger } from '../lib/logger.js';
import { ConfigError } from '../lib/errors.js';
import type { OrchestratorConfig } from '../config/schemas.js';
import { GoogleAuth } from '../auth/google-auth.js';
import { ColabProvider } from './colab-provider.js';
import { LocalProvider } from './local-provider.js';
import type { ComputeProvider } from './types.js';

/**
 * Instantiate the correct {@link ComputeProvider} based on the orchestrator
 * configuration.
 *
 * @param config - Validated orchestrator configuration.
 * @param logger - Logger instance for the provider.
 * @returns A ready-to-use {@link ComputeProvider} implementation.
 * @throws {ConfigError} If `config.provider` is not a recognised provider type.
 */
export function createProvider(
  config: OrchestratorConfig,
  logger: Logger,
): ComputeProvider {
  switch (config.provider) {
    case 'colab': {
      const auth = new GoogleAuth({
        credentialsPath: config.googleCredentialsPath,
        clientId: config.googleOAuthClientId,
        clientSecret: config.googleOAuthClientSecret,
      });
      return new ColabProvider(auth, logger);
    }

    case 'local':
      return new LocalProvider(logger);

    default:
      throw new ConfigError(
        `Unknown provider type: "${config.provider as string}"`,
        { component: 'ProviderFactory', operation: 'createProvider' },
      );
  }
}
