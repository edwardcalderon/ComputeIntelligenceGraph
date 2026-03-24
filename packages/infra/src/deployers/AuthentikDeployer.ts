/**
 * Authentik authentication provider deployment
 * @packageDocumentation
 */

import { InfraWrapper } from '../InfraWrapper';
import { ConfigManager } from '../config/ConfigManager';
import { IACIntegration } from '../iac/IACIntegration';
import { resolveIacModulesPath } from '../iac/resolveIacModulesPath';
import { Logger } from '../logging/Logger';
import {
  AuthentikDeploymentConfig,
  AuthentikBlueprintResult,
  TerraformModuleReference,
} from '../types';
import { DeploymentError, LSTSInfraError } from '../errors';

/**
 * Handles Authentik authentication provider deployment specifics
 * 
 * @remarks
 * AuthentikDeployer manages the deployment of the Authentik authentication provider
 * to AWS infrastructure. It coordinates with IACIntegration for networking modules,
 * calls @lsts_tech/infra methods through InfraWrapper.wrapLSTSCall(), and handles
 * post-deployment configuration.
 * 
 * The deployment process:
 * 1. Validates deployment configuration
 * 2. Provisions networking infrastructure via IAC modules
 * 3. Deploys Authentik container to AWS
 * 4. Configures Authentik with domain and admin settings
 * 5. Returns connection details for integration
 * 
 * @example
 * ```typescript
 * const wrapper = new InfraWrapper(configManager);
 * const deployer = new AuthentikDeployer(wrapper, configManager);
 * 
 * const result = await deployer.deploy({
 *   domain: 'auth.example.com',
 *   adminEmail: 'admin@example.com',
 *   region: 'us-east-2'
 * });
 * 
 * console.log(`Authentik deployed: ${result.connectionDetails?.url}`);
 * ```
 */
export class AuthentikDeployer {
  private wrapper: InfraWrapper;
  private config: ConfigManager;
  private logger: Logger;

  /**
   * Create a new AuthentikDeployer instance
   * 
   * @param wrapper - InfraWrapper instance for calling LSTS infra methods
   * @param config - ConfigManager instance for loading configuration
   * 
   * @example
   * ```typescript
   * const wrapper = new InfraWrapper(configManager);
   * const deployer = new AuthentikDeployer(wrapper, configManager);
   * ```
   */
  constructor(wrapper: InfraWrapper, config: ConfigManager) {
    this.wrapper = wrapper;
    this.config = config;
    
    // Initialize logger with default config
    this.logger = new Logger({
      level: 'info',
      timestamps: true
    });
  }

  /**
   * Deploy Authentik authentication provider to AWS
   * 
   * @param config - Authentik deployment configuration
   * @returns Deployment result with connection details
   * 
   * @remarks
   * Deploys the Authentik authentication provider to AWS infrastructure.
   * This includes provisioning compute resources, configuring networking,
   * and setting up the Authentik application with the specified domain
   * and admin credentials.
   * 
   * The deployment process:
   * 1. Validates deployment configuration
   * 2. Provisions networking infrastructure via IAC modules
   * 3. Deploys Authentik container to AWS
   * 4. Configures Authentik with domain and admin settings
   * 5. Returns connection details for integration
   * 
   * @throws {DeploymentError} If deployment fails at any phase
   * @throws {LSTSInfraError} If LSTS infra calls fail
   * 
   * @example
   * ```typescript
   * const result = await deployer.deploy({
   *   domain: 'auth.example.com',
   *   adminEmail: 'admin@example.com',
   *   region: 'us-east-2',
   *   vpcId: 'vpc-12345678'
   * });
   * 
   * if (result.success) {
   *   console.log(`Authentik URL: ${result.connectionDetails?.url}`);
   *   console.log(`Admin URL: ${result.connectionDetails?.adminUrl}`);
   * }
   * ```
   */
  async deploy(config: AuthentikDeploymentConfig): Promise<AuthentikBlueprintResult> {
    this.logger.info('Starting Authentik deployment', {
      domain: config.domain,
      region: config.region,
      adminEmail: config.adminEmail
    });

    // Validate configuration before touching any infrastructure
    this.validateDeploymentConfig(config);

    const iacModulesPath = resolveIacModulesPath({ providedPath: config.iacModulesPath });
    const iacIntegration = new IACIntegration(iacModulesPath, this.logger);

    const variables: Record<string, any> = {
      domain: config.domain,
      region: config.region,
    };
    if (config.vpcId) variables['vpc_id'] = config.vpcId;

    let outputs: Record<string, string> = {};

    try {
      this.logger.info('Applying authentik-aws Terraform module', { phase: 'apply' });
      outputs = await iacIntegration.applyModule('authentik-aws', variables);
    } catch (error) {
      this.logger.error('Terraform apply failed — initiating rollback', {
        error: error instanceof Error ? error.message : String(error)
      });

      try {
        await iacIntegration.destroyModule('authentik-aws', variables);
      } catch (rollbackError) {
        this.logger.error('Rollback (destroyModule) also failed', {
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        });
        // Log but re-throw the original error
      }

      throw new DeploymentError(
        `Authentik deployment failed: ${error instanceof Error ? error.message : String(error)}`,
        'authentik',
        'apply'
      );
    }

    // Validate that the required outputs are present
    const issuerUrl = outputs['issuer_url'] ?? '';
    const oidcClientId = outputs['oidc_client_id'] ?? '';
    const oidcClientSecret = outputs['oidc_client_secret'] ?? '';

    if (!issuerUrl || !oidcClientId || !oidcClientSecret) {
      // Outputs are missing — roll back and surface a clear error
      this.logger.error('Terraform outputs incomplete — initiating rollback', { outputs });

      try {
        await iacIntegration.destroyModule('authentik-aws', variables);
      } catch (rollbackError) {
        this.logger.error('Rollback after incomplete outputs failed', {
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        });
      }

      throw new DeploymentError(
        'Authentik deployment produced incomplete outputs: issuer_url, oidc_client_id, and oidc_client_secret are required',
        'authentik',
        'finalization'
      );
    }

    const result: AuthentikBlueprintResult = {
      success: true,
      resourceId: `authentik-${config.domain}`,
      url: issuerUrl,
      issuerUrl,
      oidcClientId,
      oidcClientSecret,
      connectionDetails: {
        url: issuerUrl,
        adminUrl: `${issuerUrl}/if/admin/`,
        clientId: oidcClientId,
      },
    };

    this.logger.info('Authentik deployment completed successfully', {
      issuerUrl,
      oidcClientId
    });

    return result;
  }

  /**
   * Configure Authentik post-deployment
   * 
   * @param deploymentId - Unique identifier for the deployment
   * 
   * @remarks
   * Performs post-deployment configuration of Authentik including:
   * - Setting up admin user
   * - Configuring authentication domains
   * - Setting up OAuth/OIDC providers
   * - Configuring security settings
   * 
   * @throws {DeploymentError} If configuration fails
   * 
   * @example
   * ```typescript
   * await deployer.configure('authentik-prod-123');
   * ```
   */
  async configure(deploymentId: string): Promise<void> {
    this.logger.info('Configuring Authentik instance', { deploymentId });

    try {
      // TODO: Implementation will call LSTS infra methods through wrapper
      // This is a placeholder for Task 8.1
      
      // Example of how LSTS calls would be made:
      // await this.wrapper.wrapLSTSCall(
      //   async () => lstsInfra.configureAuthentik(deploymentId, configParams),
      //   'configureAuthentik'
      // );

      this.logger.info('Authentik configuration completed', { deploymentId });
    } catch (error) {
      throw new DeploymentError(
        `Failed to configure Authentik: ${error instanceof Error ? error.message : String(error)}`,
        'authentik',
        'configuration'
      );
    }
  }

  /**
   * Get connection details for Authentik deployment
   * 
   * @param deploymentId - Unique identifier for the deployment
   * @returns Connection details including URLs and client ID
   * 
   * @remarks
   * Retrieves connection details needed for integrating other services
   * with the deployed Authentik instance. This includes:
   * - Public URL for authentication
   * - Admin URL for management
   * - OAuth client ID for integration
   * 
   * @throws {DeploymentError} If unable to retrieve connection details
   * 
   * @example
   * ```typescript
   * const details = await deployer.getConnectionDetails('authentik-prod-123');
   * console.log(`URL: ${details.url}`);
   * console.log(`Admin URL: ${details.adminUrl}`);
   * console.log(`Client ID: ${details.clientId}`);
   * ```
   */
  async getConnectionDetails(deploymentId: string): Promise<{
    url: string;
    adminUrl: string;
    clientId?: string;
  }> {
    this.logger.info('Retrieving Authentik connection details', { deploymentId });

    try {
      // TODO: Implementation will call LSTS infra methods through wrapper
      // This is a placeholder for Task 8.1
      
      // Example of how LSTS calls would be made:
      // const details = await this.wrapper.wrapLSTSCall(
      //   async () => lstsInfra.getAuthentikDetails(deploymentId),
      //   'getAuthentikDetails'
      // );

      // Placeholder return
      const details = {
        url: `https://auth-${deploymentId}.example.com`,
        adminUrl: `https://auth-${deploymentId}.example.com/admin`,
        clientId: `oauth-client-${deploymentId}`
      };

      this.logger.info('Connection details retrieved', { deploymentId, url: details.url });

      return details;
    } catch (error) {
      throw new DeploymentError(
        `Failed to retrieve connection details: ${error instanceof Error ? error.message : String(error)}`,
        'authentik',
        'finalization'
      );
    }
  }

  /**
   * Validate deployment configuration
   * 
   * @param config - Deployment configuration to validate
   * @throws {DeploymentError} If configuration is invalid
   * 
   * @private
   */
  private validateDeploymentConfig(config: AuthentikDeploymentConfig): void {
    const errors: string[] = [];

    if (!config.domain) {
      errors.push('domain is required');
    }

    if (!config.adminEmail) {
      errors.push('adminEmail is required');
    }

    if (!config.region) {
      errors.push('region is required');
    }

    // Validate email format
    if (config.adminEmail && !this.isValidEmail(config.adminEmail)) {
      errors.push('adminEmail must be a valid email address');
    }

    // Validate domain format
    if (config.domain && !this.isValidDomain(config.domain)) {
      errors.push('domain must be a valid domain name');
    }

    if (errors.length > 0) {
      throw new DeploymentError(
        `Invalid Authentik deployment configuration: ${errors.join(', ')}`,
        'authentik',
        'validation'
      );
    }
  }

  /**
   * Provision networking infrastructure via IAC modules
   * 
   * @param config - Deployment configuration
   * @returns Terraform module reference for networking
   * @throws {DeploymentError} If networking provisioning fails
   * 
   * @private
   */
  private async provisionNetworking(
    config: AuthentikDeploymentConfig
  ): Promise<TerraformModuleReference> {
    try {
      const iacIntegration = new IACIntegration(
        resolveIacModulesPath({ providedPath: config.iacModulesPath })
      );

      // Get networking module reference from IAC integration
      const networkingConfig: Record<string, any> = {
        region: config.region
      };

      // Include VPC ID if provided
      if (config.vpcId) {
        networkingConfig.vpc_id = config.vpcId;
      }

      // Include subnet ID if provided
      if (config.subnetId) {
        networkingConfig.subnet_id = config.subnetId;
      }

      const networkingModule = iacIntegration.getNetworkingModule(networkingConfig);

      // Validate the module exists
      await iacIntegration.validateModule(networkingModule.modulePath);

      this.logger.info('Networking module provisioned', {
        modulePath: networkingModule.modulePath,
        variables: networkingModule.variables
      });

      return networkingModule;
    } catch (error) {
      throw new DeploymentError(
        `Failed to provision networking: ${error instanceof Error ? error.message : String(error)}`,
        'authentik',
        'networking'
      );
    }
  }

  /**
   * Deploy Authentik container to AWS
   * 
   * @param config - Deployment configuration
   * @param networkingModule - Networking module reference
   * @returns Deployment ID
   * @throws {DeploymentError} If container deployment fails
   * 
   * @private
   */
  private async deployContainer(
    config: AuthentikDeploymentConfig,
    networkingModule: TerraformModuleReference
  ): Promise<string> {
    try {
      // TODO: Implementation will call LSTS infra methods through wrapper
      // This is a placeholder for Task 8.1
      
      // Example of how LSTS calls would be made:
      // const deploymentId = await this.wrapper.wrapLSTSCall(
      //   async () => lstsInfra.deployContainer({
      //     image: 'authentik',
      //     domain: config.domain,
      //     region: config.region,
      //     networking: networkingModule
      //   }),
      //   'deployAuthentikContainer'
      // );

      // Placeholder deployment ID
      const deploymentId = `authentik-${Date.now()}`;

      this.logger.info('Authentik container deployed', {
        deploymentId,
        domain: config.domain,
        region: config.region
      });

      return deploymentId;
    } catch (error) {
      throw new DeploymentError(
        `Failed to deploy Authentik container: ${error instanceof Error ? error.message : String(error)}`,
        'authentik',
        'deployment'
      );
    }
  }

  /**
   * Validate email address format
   * 
   * @param email - Email address to validate
   * @returns True if valid, false otherwise
   * 
   * @private
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate domain name format
   * 
   * @param domain - Domain name to validate
   * @returns True if valid, false otherwise
   * 
   * @private
   */
  private isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
    return domainRegex.test(domain);
  }
}
