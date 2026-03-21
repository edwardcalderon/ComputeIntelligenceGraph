/**
 * Provider-agnostic cloud deployment interface
 * @packageDocumentation
 *
 * Defines the contract that every cloud provider (AWS, GCP, Azure…) must satisfy.
 * Consumer code only depends on this interface, making deployments portable.
 */

export type CloudPlatform = 'aws' | 'gcp';

/**
 * Common config required by every provider.
 */
export interface ProviderConfig {
  platform: CloudPlatform;
  region: string;
  project?: string; // GCP project ID (ignored on AWS)
}

/**
 * A running service after deployment.
 */
export interface ServiceEndpoint {
  url: string;
  /** Provider-specific resource ID (Cloud Run service name, ECS ARN, …) */
  resourceId: string;
  platform: CloudPlatform;
}

/**
 * Input for deploying a containerised service.
 */
export interface ContainerDeployInput {
  /** Fully-qualified image URI, e.g. us-central1-docker.pkg.dev/… */
  image: string;
  /** Port the container listens on */
  port: number;
  /** Environment variables injected at runtime (non-secret, non-NEXT_PUBLIC_* only) */
  env?: Record<string, string>;
  /** Compute sizing */
  cpu?: string;
  memoryMiB?: number;
  /** Scaling */
  minInstances?: number;
  maxInstances?: number;
}

/**
 * Interface every cloud provider adapter must implement.
 */
export interface CloudProvider {
  readonly platform: CloudPlatform;

  /**
   * Authenticate / initialise the provider session.
   * Called once before any deployment method.
   */
  authenticate(): Promise<void>;

  /**
   * Push a container image to this provider's registry.
   * Returns the fully-qualified image URI that should be used for deployment.
   */
  pushImage(localTag: string, repositoryName: string): Promise<string>;

  /**
   * Deploy (or update) a container service.
   */
  deployContainer(
    serviceName: string,
    input: ContainerDeployInput
  ): Promise<ServiceEndpoint>;

  /**
   * Map a custom domain to a deployed service.
   */
  mapDomain(serviceName: string, domain: string): Promise<void>;

  /**
   * Destroy a deployed service and its resources.
   */
  destroy(serviceName: string): Promise<void>;
}
