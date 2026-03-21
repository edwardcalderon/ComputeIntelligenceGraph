/**
 * AWS provider stub
 * @packageDocumentation
 *
 * Wraps @lsts_tech/infra (SST/Pulumi) for AWS deployments.
 * Implements the same CloudProvider interface as GcpProvider so callers
 * are fully provider-agnostic.
 *
 * Full implementation delegates to existing AWS deployers (DashboardDeployer,
 * AuthentikDeployer) and will be completed as those are fleshed out.
 */

import {
  CloudProvider,
  CloudPlatform,
  ContainerDeployInput,
  ServiceEndpoint,
} from './CloudProvider';
import { Logger } from '../logging/Logger';

export interface AwsProviderConfig {
  region: string;
  accountId?: string;
  profile?: string;
}

/**
 * AWS provider — thin wrapper until @lsts_tech/infra stacks are wired.
 */
export class AwsProvider implements CloudProvider {
  readonly platform: CloudPlatform = 'aws';

  private readonly region: string;
  private readonly logger: Logger;

  constructor(config: AwsProviderConfig, logger?: Logger) {
    this.region = config.region;
    this.logger = logger ?? new Logger({ level: 'info', timestamps: true });
  }

  async authenticate(): Promise<void> {
    // ADC / instance profile / env vars — no explicit step needed in CI
    this.logger.info('AWS: using ambient credentials (env/profile/instance role)');
  }

  async pushImage(localTag: string, repositoryName: string): Promise<string> {
    // TODO: ECR login + tag + push via @lsts_tech/infra Pipeline stack
    throw new Error(
      `AWS.pushImage not yet implemented. Use @lsts_tech/infra Pipeline stack for ECR push.`
    );
  }

  async deployContainer(
    serviceName: string,
    input: ContainerDeployInput
  ): Promise<ServiceEndpoint> {
    // TODO: wire to @lsts_tech/infra NextSite / Lambda stack
    throw new Error(
      `AWS.deployContainer not yet implemented. Use @lsts_tech/infra stacks directly.`
    );
  }

  async mapDomain(serviceName: string, domain: string): Promise<void> {
    // TODO: Route 53 + CloudFront via @lsts_tech/infra Dns stack
    throw new Error(`AWS.mapDomain not yet implemented.`);
  }

  async destroy(serviceName: string): Promise<void> {
    throw new Error(`AWS.destroy not yet implemented.`);
  }
}
