/**
 * Type definitions for infrastructure deployment
 * @packageDocumentation
 */

/**
 * Result of a deployment operation
 * 
 * @remarks
 * This interface represents the outcome of any infrastructure deployment operation.
 * It includes success status, resource identifiers, URLs, and connection details.
 * 
 * @example
 * ```typescript
 * const result: DeploymentResult = {
 *   success: true,
 *   resourceId: 'authentik-prod-123',
 *   url: 'https://auth.example.com',
 *   connectionDetails: {
 *     adminUrl: 'https://auth.example.com/admin',
 *     clientId: 'oauth-client-123'
 *   }
 * };
 * ```
 */
export interface DeploymentResult {
  /** Whether the deployment succeeded */
  success: boolean;
  /** Unique identifier for the deployed resource */
  resourceId?: string;
  /** Public URL of the deployed resource */
  url?: string;
  /** Connection details for integration (URLs, endpoints, credentials) */
  connectionDetails?: Record<string, string>;
  /** Error message if deployment failed */
  error?: string;
}

/**
 * Options for deployment operations
 * 
 * @remarks
 * Specifies the target environment, region, and additional configuration
 * for infrastructure deployment operations.
 * 
 * @example
 * ```typescript
 * const options: DeploymentOptions = {
 *   environment: 'production',
 *   region: 'us-east-1',
 *   config: { enableBackups: true }
 * };
 * ```
 */
export interface DeploymentOptions {
  /** Target environment (e.g., 'development', 'staging', 'production') */
  environment: string;
  /** AWS region for deployment */
  region: string;
  /** Additional configuration parameters */
  config?: Record<string, any>;
}

/**
 * Information about a deployed resource
 * 
 * @remarks
 * Contains comprehensive information about a deployment including its status,
 * associated AWS resources, and metadata.
 */
export interface DeploymentInfo {
  /** Unique deployment identifier */
  id: string;
  /** Type of deployment */
  type: 'authentik' | 'dashboard';
  /** Environment name */
  environment: string;
  /** AWS region */
  region: string;
  /** Current deployment status */
  status: DeploymentStatus;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Associated AWS resources */
  resources: ResourceInfo[];
  /** Additional metadata */
  metadata: Record<string, any>;
}

/**
 * Deployment status enumeration
 * 
 * @remarks
 * Represents the current state of a deployment operation throughout its lifecycle.
 */
export enum DeploymentStatus {
  /** Deployment is queued but not yet started */
  PENDING = 'pending',
  /** Deployment is currently in progress */
  IN_PROGRESS = 'in_progress',
  /** Deployment completed successfully */
  COMPLETED = 'completed',
  /** Deployment failed */
  FAILED = 'failed',
  /** Deployment was rolled back due to failure */
  ROLLED_BACK = 'rolled_back'
}

/**
 * Information about an AWS resource
 * 
 * @remarks
 * Describes a single AWS resource that is part of a deployment.
 */
export interface ResourceInfo {
  /** Resource type (e.g., 'ec2', 's3', 'cloudfront') */
  type: string;
  /** AWS resource ID */
  id: string;
  /** AWS ARN */
  arn?: string;
  /** Public URL if applicable */
  url?: string;
}

/**
 * Main infrastructure configuration
 * 
 * @remarks
 * Top-level configuration object that contains all settings required for
 * infrastructure deployment operations. This includes AWS credentials,
 * service-specific configurations, IAC module settings, and logging preferences.
 * 
 * @example
 * ```typescript
 * const config: InfraConfig = {
 *   aws: {
 *     region: 'us-east-1',
 *     profile: 'default'
 *   },
 *   authentik: {
 *     domain: 'auth.example.com',
 *     adminEmail: 'admin@example.com'
 *   },
 *   dashboard: {
 *     buildPath: './apps/dashboard/.next',
 *     authentikIntegration: true
 *   },
 *   iac: {
 *     modulesPath: '../iac',
 *     networkingModule: 'networking',
 *     computeModule: 'compute'
 *   },
 *   logging: {
 *     level: 'info',
 *     timestamps: true
 *   }
 * };
 * ```
 */
export interface InfraConfig {
  /** AWS configuration */
  aws: AWSConfig;
  /** Authentik configuration */
  authentik: AuthentikConfig;
  /** Dashboard configuration */
  dashboard: DashboardConfig;
  /** IAC module configuration */
  iac: IACConfig;
  /** Logging configuration */
  logging: LoggingConfig;
}

/**
 * AWS configuration
 * 
 * @remarks
 * Specifies AWS credentials and region settings for infrastructure deployment.
 * The accountId can be auto-detected if not provided.
 * 
 * @example
 * ```typescript
 * const awsConfig: AWSConfig = {
 *   region: 'us-west-2',
 *   profile: 'production'
 * };
 * ```
 */
export interface AWSConfig {
  /** AWS region (e.g., 'us-east-1') */
  region: string;
  /** AWS account ID (optional, can be detected) */
  accountId?: string;
  /** AWS CLI profile name */
  profile?: string;
}

/**
 * Authentik configuration
 * 
 * @remarks
 * Configuration for deploying the Authentik authentication provider.
 * VPC and subnet IDs are optional and will use IAC module defaults if not provided.
 * 
 * @example
 * ```typescript
 * const authentikConfig: AuthentikConfig = {
 *   domain: 'auth.cig.example.com',
 *   adminEmail: 'admin@example.com',
 *   vpcId: 'vpc-12345678'
 * };
 * ```
 */
export interface AuthentikConfig {
  /** Domain for Authentik (e.g., 'auth.cig.example.com') */
  domain: string;
  /** Admin email for initial setup */
  adminEmail: string;
  /** VPC ID (optional, will use IAC module default) */
  vpcId?: string;
  /** Subnet ID (optional, will use IAC module default) */
  subnetId?: string;
}

/**
 * Dashboard configuration
 * 
 * @remarks
 * Configuration for deploying the Next.js dashboard application.
 * Supports custom domains and Authentik authentication integration.
 * 
 * @example
 * ```typescript
 * const dashboardConfig: DashboardConfig = {
 *   buildPath: './apps/dashboard/.next',
 *   domain: 'dashboard.example.com',
 *   authentikIntegration: true
 * };
 * ```
 */
export interface DashboardConfig {
  /** Custom domain (optional) */
  domain?: string;
  /** Path to built dashboard files */
  buildPath: string;
  /** Enable Authentik integration */
  authentikIntegration: boolean;
}

/**
 * IAC module configuration
 * 
 * @remarks
 * Specifies paths and module names for integrating with @cig/iac Terraform modules.
 * These modules provide networking and compute infrastructure.
 * 
 * @example
 * ```typescript
 * const iacConfig: IACConfig = {
 *   modulesPath: '../iac',
 *   networkingModule: 'networking',
 *   computeModule: 'compute'
 * };
 * ```
 */
export interface IACConfig {
  /** Path to @cig/iac modules */
  modulesPath: string;
  /** Networking module name */
  networkingModule: string;
  /** Compute module name */
  computeModule: string;
}

/**
 * Logging configuration
 * 
 * @remarks
 * Controls logging behavior including log level filtering and timestamp formatting.
 * 
 * @example
 * ```typescript
 * const loggingConfig: LoggingConfig = {
 *   level: 'info',
 *   timestamps: true
 * };
 * ```
 */
export interface LoggingConfig {
  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Include timestamps in log messages */
  timestamps: boolean;
}

/**
 * Configuration validation result
 * 
 * @remarks
 * Returned by ConfigManager.validate() to indicate whether configuration is valid
 * and provide specific error messages for any validation failures.
 * 
 * @example
 * ```typescript
 * const result: ValidationResult = {
 *   valid: false,
 *   errors: ['aws.region is required', 'authentik.domain is required']
 * };
 * ```
 */
export interface ValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;
  /** List of validation errors */
  errors: string[];
}

/**
 * Authentik-specific deployment configuration
 * 
 * @remarks
 * Extended configuration specifically for Authentik deployment operations.
 * Includes all necessary parameters for provisioning Authentik to AWS.
 */
export interface AuthentikDeploymentConfig {
  /** Domain for Authentik */
  domain: string;
  /** Admin email */
  adminEmail: string;
  /** AWS region */
  region: string;
  /** VPC ID (optional) */
  vpcId?: string;
  /** Subnet ID (optional) */
  subnetId?: string;
}

/**
 * Authentik deployment result
 * 
 * @remarks
 * Extended deployment result specifically for Authentik deployments.
 * Includes connection details needed for integrating other services with Authentik.
 */
export interface AuthentikDeploymentResult extends DeploymentResult {
  /** Connection details for Authentik */
  connectionDetails?: {
    /** Authentik URL */
    url: string;
    /** Admin URL */
    adminUrl: string;
    /** OAuth client ID */
    clientId?: string;
  };
}

/**
 * Dashboard-specific deployment configuration
 * 
 * @remarks
 * Extended configuration specifically for dashboard deployment operations.
 * Includes Authentik integration parameters for authentication.
 */
export interface DashboardDeploymentConfig {
  /** Path to built dashboard files */
  buildPath: string;
  /** Custom domain (optional) */
  domain?: string;
  /** AWS region */
  region: string;
  /** Authentik URL for integration */
  authentikUrl: string;
  /** Authentik OAuth client ID */
  authentikClientId: string;
}

/**
 * Dashboard deployment result
 * 
 * @remarks
 * Extended deployment result specifically for dashboard deployments.
 * Always includes the deployed URL for accessing the dashboard.
 */
export interface DashboardDeploymentResult extends DeploymentResult {
  /** Deployed dashboard URL */
  url: string;
}

/**
 * Terraform module reference
 * 
 * @remarks
 * Specifies a reference to a Terraform module from @cig/iac along with
 * the variables to pass to that module during infrastructure provisioning.
 * 
 * @example
 * ```typescript
 * const moduleRef: TerraformModuleReference = {
 *   modulePath: '../iac/networking',
 *   variables: {
 *     vpc_cidr: '10.0.0.0/16',
 *     availability_zones: ['us-east-1a', 'us-east-1b']
 *   }
 * };
 * ```
 */
export interface TerraformModuleReference {
  /** Path to the Terraform module */
  modulePath: string;
  /** Variables to pass to the module */
  variables: Record<string, any>;
}
