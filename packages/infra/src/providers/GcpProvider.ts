/**
 * Google Cloud Platform provider implementation
 * @packageDocumentation
 *
 * Implements CloudProvider using gcloud CLI / REST APIs.
 * Uses Application Default Credentials (ADC) — works transparently with
 * Workload Identity Federation in CI and service account keys locally.
 */

import { execSync } from 'child_process';
import {
  CloudProvider,
  CloudPlatform,
  ContainerDeployInput,
  ServiceEndpoint,
} from './CloudProvider';
import { Logger } from '../logging/Logger';

export interface GcpProviderConfig {
  project: string;
  region: string;
  /** Artifact Registry hostname, e.g. us-central1-docker.pkg.dev */
  registry?: string;
  /** Artifact Registry repository name, e.g. "cig" */
  repository?: string;
}

/**
 * GCP Cloud Run provider.
 *
 * All operations are implemented via the `gcloud` CLI so that the package
 * carries no GCP SDK dependency — the CLI is already available in CI
 * (google-github-actions/setup-gcloud) and locally.
 */
export class GcpProvider implements CloudProvider {
  readonly platform: CloudPlatform = 'gcp';

  private readonly project: string;
  private readonly region: string;
  private readonly registry: string;
  private readonly repository: string;
  private readonly logger: Logger;

  constructor(config: GcpProviderConfig, logger?: Logger) {
    this.project = config.project;
    this.region = config.region;
    this.registry = config.registry ?? `${config.region}-docker.pkg.dev`;
    this.repository = config.repository ?? 'cig';
    this.logger = logger ?? new Logger({ level: 'info', timestamps: true });
  }

  async authenticate(): Promise<void> {
    this.logger.info('GCP: configuring Docker for Artifact Registry', {
      registry: this.registry,
    });
    this.run(`gcloud auth configure-docker ${this.registry} --quiet`);
  }

  async pushImage(localTag: string, repositoryName: string): Promise<string> {
    const remoteTag = `${this.registry}/${this.project}/${this.repository}/${repositoryName}:latest`;
    this.logger.info('GCP: tagging & pushing image', { localTag, remoteTag });
    this.run(`docker tag ${localTag} ${remoteTag}`);
    this.run(`docker push ${remoteTag}`);
    return remoteTag;
  }

  async deployContainer(
    serviceName: string,
    input: ContainerDeployInput
  ): Promise<ServiceEndpoint> {
    const {
      image,
      port = 8080,
      env = {},
      cpu = '1',
      memoryMiB = 512,
      minInstances = 0,
      maxInstances = 5,
    } = input;

    const envVarsArg = Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join(',');

    const flags = [
      `--image=${image}`,
      `--region=${this.region}`,
      `--project=${this.project}`,
      `--platform=managed`,
      `--allow-unauthenticated`,
      `--port=${port}`,
      `--cpu=${cpu}`,
      `--memory=${memoryMiB}Mi`,
      `--min-instances=${minInstances}`,
      `--max-instances=${maxInstances}`,
      `--concurrency=80`,
      `--timeout=30s`,
    ];

    if (envVarsArg) {
      flags.push(`--set-env-vars="${envVarsArg}"`);
    }

    this.logger.info('GCP: deploying Cloud Run service', { serviceName });
    this.run(`gcloud run deploy ${serviceName} ${flags.join(' ')}`);

    const url = this.run(
      `gcloud run services describe ${serviceName} --region=${this.region} --project=${this.project} --format="value(status.url)"`
    ).trim();

    this.logger.info('GCP: Cloud Run service deployed', { serviceName, url });

    return {
      url,
      resourceId: serviceName,
      platform: 'gcp',
    };
  }

  async mapDomain(serviceName: string, domain: string): Promise<void> {
    this.logger.info('GCP: creating domain mapping', { serviceName, domain });
    try {
      this.run(
        `gcloud run domain-mappings create --service=${serviceName} --domain=${domain} --region=${this.region} --project=${this.project}`
      );
    } catch (e: any) {
      // Domain mapping already exists — idempotent
      if (e.message?.includes('already exists')) {
        this.logger.info('GCP: domain mapping already exists, skipping');
        return;
      }
      throw e;
    }
  }

  async destroy(serviceName: string): Promise<void> {
    this.logger.info('GCP: deleting Cloud Run service', { serviceName });
    this.run(
      `gcloud run services delete ${serviceName} --region=${this.region} --project=${this.project} --quiet`
    );
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private run(cmd: string): string {
    this.logger.debug('GCP exec', { cmd });
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  }
}
