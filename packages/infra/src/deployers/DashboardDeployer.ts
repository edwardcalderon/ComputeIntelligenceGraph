/**
 * Dashboard application deployment
 * @packageDocumentation
 */

import { InfraWrapper } from '../InfraWrapper';
import { ConfigManager } from '../config/ConfigManager';
import { IACIntegration } from '../iac/IACIntegration';
import { resolveIacModulesPath } from '../iac/resolveIacModulesPath';
import { Logger } from '../logging/Logger';
import {
  DashboardDeploymentConfig,
  DashboardDeploymentResult,
  TerraformModuleReference,
} from '../types';
import { DeploymentError, LSTSInfraError } from '../errors';

/**
 * Handles dashboard application deployment and Authentik authentication integration
 * 
 * @remarks
 * DashboardDeployer manages the deployment of the Next.js dashboard application
 * to AWS infrastructure. It coordinates with IACIntegration for compute modules,
 * calls @lsts_tech/infra methods through InfraWrapper.wrapLSTSCall(), and handles
 * Authentik authentication integration.
 * 
 * The deployment process:
 * 1. Validates deployment configuration
 * 2. Provisions compute infrastructure via IAC modules
 * 3. Deploys dashboard to AWS
 * 4. Integrates with Authentik for authentication
 * 5. Returns deployed URL
 * 
 * @example
 * ```typescript
 * const wrapper = new InfraWrapper(configManager);
 * const deployer = new DashboardDeployer(wrapper, configManager);
 * 
 * const result = await deployer.deploy({
 *   buildPath: './apps/dashboard/.next',
 *   region: 'us-east-2',
 *   authentikUrl: 'https://auth.example.com',
 *   authentikClientId: 'oauth-client-123'
 * });
 * 
 * console.log(`Dashboard deployed: ${result.url}`);
 * ```
 */
export class DashboardDeployer {
  private wrapper: InfraWrapper;
  private config: ConfigManager;
  private logger: Logger;

  /**
   * Create a new DashboardDeployer instance
   * 
   * @param wrapper - InfraWrapper instance for calling LSTS infra methods
   * @param config - ConfigManager instance for loading configuration
   * 
   * @example
   * ```typescript
   * const wrapper = new InfraWrapper(configManager);
   * const deployer = new DashboardDeployer(wrapper, configManager);
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
   * Deploy dashboard application to AWS
   * 
   * @param config - Dashboard deployment configuration
   * @returns Deployment result with deployed URL
   * 
   * @remarks
   * Deploys the Next.js dashboard application to AWS infrastructure with
   * integrated Authentik authentication. This includes provisioning hosting
   * infrastructure, uploading build artifacts, and configuring authentication.
   * 
   * The deployment process:
   * 1. Validates deployment configuration
   * 2. Provisions compute infrastructure via IAC modules
   * 3. Deploys dashboard to AWS
   * 4. Integrates with Authentik for authentication
   * 5. Returns deployed URL
   * 
   * @throws {DeploymentError} If deployment fails at any phase
   * @throws {LSTSInfraError} If LSTS infra calls fail
   * 
   * @example
   * ```typescript
   * const result = await deployer.deploy({
   *   buildPath: './apps/dashboard/.next',
   *   domain: 'dashboard.example.com',
   *   region: 'us-east-2',
   *   authentikUrl: 'https://auth.example.com',
   *   authentikClientId: 'oauth-client-123'
   * });
   * 
   * if (result.success) {
   *   console.log(`Dashboard URL: ${result.url}`);
   * }
   * ```
   */
  async deploy(config: DashboardDeploymentConfig): Promise<DashboardDeploymentResult> {
    this.logger.info('Starting dashboard deployment', {
      buildPath: config.buildPath,
      region: config.region,
      domain: config.domain
    });

    try {
      // Phase 1: Validate configuration
      this.logger.info('Validating deployment configuration', { phase: 'validation' });
      this.validateDeploymentConfig(config);

      // Phase 2: Provision compute infrastructure
      this.logger.info('Provisioning compute infrastructure', { phase: 'compute' });
      const computeModule = await this.provisionCompute(config);
      
      // Phase 3: Deploy dashboard
      this.logger.info('Deploying dashboard application', { phase: 'deployment' });
      const deploymentId = await this.deployDashboardApp(config, computeModule);

      // Phase 4: Integrate with Authentik
      this.logger.info('Integrating Authentik authentication', { phase: 'authentication' });
      await this.integrateAuthentik(deploymentId, {
        authentikUrl: config.authentikUrl,
        authentikClientId: config.authentikClientId
      });

      // Phase 5: Get deployed URL
      this.logger.info('Retrieving deployed URL', { phase: 'finalization' });
      const url = await this.getDeployedUrl(deploymentId, config.domain);

      const result: DashboardDeploymentResult = {
        success: true,
        resourceId: deploymentId,
        url
      };

      this.logger.info('Dashboard deployment completed successfully', {
        resourceId: deploymentId,
        url
      });

      return result;
    } catch (error) {
      this.logger.error('Dashboard deployment failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // Re-throw deployment errors as-is
      if (error instanceof DeploymentError || error instanceof LSTSInfraError) {
        throw error;
      }

      // Wrap other errors in DeploymentError
      throw new DeploymentError(
        `Dashboard deployment failed: ${error instanceof Error ? error.message : String(error)}`,
        'dashboard',
        'unknown'
      );
    }
  }

  /**
   * Integrate dashboard with Authentik for authentication
   * 
   * @param deploymentId - Unique identifier for the deployment
   * @param authentikConfig - Authentik connection details
   * 
   * @remarks
   * Configures the dashboard to use Authentik for authentication including:
   * - Setting up OAuth/OIDC client configuration
   * - Configuring redirect URLs
   * - Setting up session management
   * - Configuring authentication middleware
   * 
   * @throws {DeploymentError} If integration fails
   * 
   * @example
   * ```typescript
   * await deployer.integrateAuthentik('dashboard-prod-123', {
   *   authentikUrl: 'https://auth.example.com',
   *   authentikClientId: 'oauth-client-123'
   * });
   * ```
   */
  async integrateAuthentik(
    deploymentId: string,
    authentikConfig: Record<string, string>
  ): Promise<void> {
    this.logger.info('Integrating Authentik authentication', {
      deploymentId,
      authentikUrl: authentikConfig.authentikUrl
    });

    try {
      // TODO: Implementation will call LSTS infra methods through wrapper
      // This is a placeholder for Task 9.1
      
      // Example of how LSTS calls would be made:
      // await this.wrapper.wrapLSTSCall(
      //   async () => lstsInfra.configureAuthentication(deploymentId, {
      //     provider: 'authentik',
      //     url: authentikConfig.authentikUrl,
      //     clientId: authentikConfig.authentikClientId
      //   }),
      //   'configureDashboardAuthentication'
      // );

      this.logger.info('Authentik integration completed', { deploymentId });
    } catch (error) {
      throw new DeploymentError(
        `Failed to integrate Authentik: ${error instanceof Error ? error.message : String(error)}`,
        'dashboard',
        'authentication'
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
  private validateDeploymentConfig(config: DashboardDeploymentConfig): void {
    const errors: string[] = [];

    if (!config.buildPath) {
      errors.push('buildPath is required');
    }

    if (!config.region) {
      errors.push('region is required');
    }

    if (!config.authentikUrl) {
      errors.push('authentikUrl is required');
    }

    if (!config.authentikClientId) {
      errors.push('authentikClientId is required');
    }

    // Validate URL format for authentikUrl
    if (config.authentikUrl && !this.isValidUrl(config.authentikUrl)) {
      errors.push('authentikUrl must be a valid URL');
    }

    // Validate domain format if provided
    if (config.domain && !this.isValidDomain(config.domain)) {
      errors.push('domain must be a valid domain name');
    }

    if (errors.length > 0) {
      throw new DeploymentError(
        `Invalid dashboard deployment configuration: ${errors.join(', ')}`,
        'dashboard',
        'validation'
      );
    }
  }

  /**
   * Provision compute infrastructure via IAC modules
   * 
   * @param config - Deployment configuration
   * @returns Terraform module reference for compute
   * @throws {DeploymentError} If compute provisioning fails
   * 
   * @private
   */
  private async provisionCompute(
    config: DashboardDeploymentConfig
  ): Promise<TerraformModuleReference> {
    try {
      const iacIntegration = new IACIntegration(
        resolveIacModulesPath({ providedPath: config.iacModulesPath })
      );

      // Get compute module reference from IAC integration
      const computeConfig: Record<string, any> = {
        region: config.region,
        buildPath: config.buildPath
      };

      // Include domain if provided
      if (config.domain) {
        computeConfig.domain = config.domain;
      }

      const computeModule = iacIntegration.getComputeModule(computeConfig);

      // Validate the module exists
      await iacIntegration.validateModule(computeModule.modulePath);

      this.logger.info('Compute module provisioned', {
        modulePath: computeModule.modulePath,
        variables: computeModule.variables
      });

      return computeModule;
    } catch (error) {
      throw new DeploymentError(
        `Failed to provision compute: ${error instanceof Error ? error.message : String(error)}`,
        'dashboard',
        'compute'
      );
    }
  }

  /**
   * Deploy dashboard application to AWS
   * 
   * @param config - Deployment configuration
   * @param computeModule - Compute module reference
   * @returns Deployment ID
   * @throws {DeploymentError} If dashboard deployment fails
   * 
   * @private
   */
  private async deployDashboardApp(
    config: DashboardDeploymentConfig,
    computeModule: TerraformModuleReference
  ): Promise<string> {
    try {
      // TODO: Implementation will call LSTS infra methods through wrapper
      // This is a placeholder for Task 9.1
      
      // Example of how LSTS calls would be made:
      // const deploymentId = await this.wrapper.wrapLSTSCall(
      //   async () => lstsInfra.deployStaticSite({
      //     buildPath: config.buildPath,
      //     domain: config.domain,
      //     region: config.region,
      //     compute: computeModule
      //   }),
      //   'deployDashboard'
      // );

      // Placeholder deployment ID
      const deploymentId = `dashboard-${Date.now()}`;

      this.logger.info('Dashboard application deployed', {
        deploymentId,
        buildPath: config.buildPath,
        region: config.region
      });

      return deploymentId;
    } catch (error) {
      throw new DeploymentError(
        `Failed to deploy dashboard application: ${error instanceof Error ? error.message : String(error)}`,
        'dashboard',
        'deployment'
      );
    }
  }

  /**
   * Get deployed URL for dashboard
   * 
   * @param deploymentId - Unique identifier for the deployment
   * @param customDomain - Custom domain if provided
   * @returns Deployed URL
   * @throws {DeploymentError} If unable to retrieve URL
   * 
   * @private
   */
  private async getDeployedUrl(
    deploymentId: string,
    customDomain?: string
  ): Promise<string> {
    try {
      // TODO: Implementation will call LSTS infra methods through wrapper
      // This is a placeholder for Task 9.1
      
      // Example of how LSTS calls would be made:
      // const url = await this.wrapper.wrapLSTSCall(
      //   async () => lstsInfra.getDeploymentUrl(deploymentId),
      //   'getDashboardUrl'
      // );

      // Placeholder URL
      const url = customDomain
        ? `https://${customDomain}`
        : `https://dashboard-${deploymentId}.example.com`;

      this.logger.info('Deployed URL retrieved', { deploymentId, url });

      return url;
    } catch (error) {
      throw new DeploymentError(
        `Failed to retrieve deployed URL: ${error instanceof Error ? error.message : String(error)}`,
        'dashboard',
        'finalization'
      );
    }
  }

  /**
   * Validate URL format
   * 
   * @param url - URL to validate
   * @returns True if valid, false otherwise
   * 
   * @private
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
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
