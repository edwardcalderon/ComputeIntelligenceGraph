/**
 * GCP Cloud Run deployer
 * @packageDocumentation
 *
 * Deploys any containerised service (dashboard, API, chatbot…) to Cloud Run.
 * Mirrors the shape of DashboardDeployer for parity but is service-agnostic —
 * pass any image and it will deploy it.
 */

import { GcpProvider, GcpProviderConfig } from '../providers/GcpProvider';
import { ContainerDeployInput, ServiceEndpoint } from '../providers/CloudProvider';
import { Logger } from '../logging/Logger';
import { DeploymentError } from '../errors';

export interface GcpCloudRunDeployConfig {
  /** GCP project & region */
  provider: GcpProviderConfig;
  /** Cloud Run service name */
  serviceName: string;
  /** Fully-qualified image URI already in Artifact Registry */
  image: string;
  /** Port the container exposes (default: 8080) */
  port?: number;
  /** Runtime env vars (no NEXT_PUBLIC_* — those are baked at build time) */
  env?: Record<string, string>;
  /** Custom domain to map after deploy (e.g. app.cig.lat) */
  domain?: string;
  /** Resource sizing overrides */
  cpu?: string;
  memoryMiB?: number;
  minInstances?: number;
  maxInstances?: number;
}

export interface GcpCloudRunDeployResult {
  success: boolean;
  url: string;
  resourceId: string;
  error?: string;
}

/**
 * Deploys a container to Google Cloud Run.
 *
 * @example
 * ```typescript
 * const deployer = new GcpCloudRunDeployer({ level: 'info', timestamps: true });
 *
 * const result = await deployer.deploy({
 *   provider: { project: 'cig-technology', region: 'us-central1' },
 *   serviceName: 'dashboard',
 *   image: 'us-central1-docker.pkg.dev/cig-technology/cig/dashboard:v0.1.25',
 *   port: 3000,
 *   env: { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
 *   domain: 'app.cig.lat',
 * });
 *
 * console.log(result.url); // https://dashboard-xxxx-uc.a.run.app
 * ```
 */
export class GcpCloudRunDeployer {
  private readonly logger: Logger;

  constructor(loggingConfig?: { level: 'debug' | 'info' | 'warn' | 'error'; timestamps: boolean }) {
    this.logger = new Logger(
      loggingConfig ?? { level: 'info', timestamps: true }
    );
  }

  async deploy(config: GcpCloudRunDeployConfig): Promise<GcpCloudRunDeployResult> {
    const provider = new GcpProvider(config.provider, this.logger);

    try {
      await provider.authenticate();

      const containerInput: ContainerDeployInput = {
        image: config.image,
        port: config.port ?? 8080,
        env: config.env ?? {},
        cpu: config.cpu,
        memoryMiB: config.memoryMiB,
        minInstances: config.minInstances,
        maxInstances: config.maxInstances,
      };

      const endpoint: ServiceEndpoint = await provider.deployContainer(
        config.serviceName,
        containerInput
      );

      if (config.domain) {
        await provider.mapDomain(config.serviceName, config.domain);
        this.logger.info('GCP: domain mapped', { domain: config.domain });
      }

      return {
        success: true,
        url: endpoint.url,
        resourceId: endpoint.resourceId,
      };
    } catch (error: any) {
      this.logger.error('GCP Cloud Run deployment failed', {
        serviceName: config.serviceName,
        error: error.message,
      });
      throw new DeploymentError(
        `Cloud Run deployment failed: ${error.message}`,
        'gcp-cloud-run',
        'deploy'
      );
    }
  }

  async destroy(
    providerConfig: GcpProviderConfig,
    serviceName: string
  ): Promise<void> {
    const provider = new GcpProvider(providerConfig, this.logger);
    await provider.destroy(serviceName);
  }
}
