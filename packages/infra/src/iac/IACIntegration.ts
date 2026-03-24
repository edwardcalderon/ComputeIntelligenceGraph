/**
 * IAC Integration module for @cig/iac Terraform modules
 * @packageDocumentation
 */

import * as fs from 'fs';
import * as path from 'path';
import { TerraformModuleReference } from '../types';
import { InfraError, ErrorCode } from '../errors';

/**
 * Manages integration with @cig/iac Terraform modules
 * 
 * @remarks
 * This class provides methods to reference and validate Terraform modules
 * from the @cig/iac package, including networking and compute infrastructure modules.
 * 
 * @example
 * ```typescript
 * const iacIntegration = new IACIntegration('../iac');
 * const networkingModule = iacIntegration.getNetworkingModule({ vpc_cidr: '10.0.0.0/16' });
 * const computeModule = iacIntegration.getComputeModule({ instance_type: 't3.micro' });
 * ```
 */
export class IACIntegration {
  private readonly iacModulesPath: string;
  private readonly networkingModuleName = 'networking';
  private readonly computeModuleName = 'compute';
  private readonly logger?: { info?: (msg: string, ctx?: any) => void };

  /**
   * Create an IAC integration instance
   *
   * @param iacModulesPath - Path to the @cig/iac modules directory
   * @param logger - Optional logger instance
   */
  constructor(iacModulesPath: string, logger?: { info?: (msg: string, ctx?: any) => void }) {
    this.iacModulesPath = iacModulesPath;
    this.logger = logger;
  }

  /**
   * Get a reference to the networking Terraform module
   * 
   * @param config - Configuration parameters to pass to the networking module
   * @returns Terraform module reference with path and variables
   * 
   * @remarks
   * The networking module provides VPC, subnets, and security group infrastructure.
   * Common configuration parameters include:
   * - vpc_cidr: CIDR block for the VPC (e.g., '10.0.0.0/16')
   * - availability_zones: List of availability zones
   * - enable_nat_gateway: Whether to enable NAT gateway
   * 
   * @example
   * ```typescript
   * const networkingModule = iacIntegration.getNetworkingModule({
   *   vpc_cidr: '10.0.0.0/16',
   *   availability_zones: ['us-east-2a', 'us-east-2b']
   * });
   * ```
   */
  getNetworkingModule(config: Record<string, any> = {}): TerraformModuleReference {
    const modulePath = this.resolveModulePath(this.networkingModuleName);
    
    return {
      modulePath,
      variables: config
    };
  }

  /**
   * Get a reference to the compute Terraform module
   * 
   * @param config - Configuration parameters to pass to the compute module
   * @returns Terraform module reference with path and variables
   * 
   * @remarks
   * The compute module provides EC2 instance infrastructure.
   * Common configuration parameters include:
   * - region: AWS region (e.g., 'us-east-2')
   * - instance_type: EC2 instance type (e.g., 't3.micro')
   * - vpc_id: VPC ID where the instance will be deployed
   * - subnet_id: Subnet ID where the instance will be deployed
   * - key_name: EC2 key pair name for SSH access
   * - tags: Additional tags to apply to resources
   * 
   * @example
   * ```typescript
   * const computeModule = iacIntegration.getComputeModule({
   *   region: 'us-east-2',
   *   instance_type: 't3.micro',
   *   vpc_id: 'vpc-12345678',
   *   subnet_id: 'subnet-12345678'
   * });
   * ```
   */
  getComputeModule(config: Record<string, any> = {}): TerraformModuleReference {
    const modulePath = this.resolveModulePath(this.computeModuleName);
    
    return {
      modulePath,
      variables: config
    };
  }

  /**
   * Apply a Terraform module (terraform init + apply)
   *
   * @param moduleName - Name of the module under `modules/` (e.g. 'authentik-aws')
   * @param variables - Input variables to pass to the module
   * @returns Terraform outputs as a key-value map
   *
   * @throws {InfraError} If the module is not found or apply fails
   */
  async applyModule(
    moduleName: string,
    variables: Record<string, any>
  ): Promise<Record<string, string>> {
    const modulePath = this.resolveModulePath(moduleName);
    await this.validateModule(modulePath);

    // In a real implementation this would shell out to `terraform apply`.
    // The stub returns an empty map; callers should replace this with a real
    // Terraform runner or a test double.
    this.logger?.info?.(`Applying Terraform module: ${moduleName}`, { variables });
    return {};
  }

  /**
   * Destroy resources provisioned by a Terraform module (terraform destroy)
   *
   * @param moduleName - Name of the module under `modules/` (e.g. 'authentik-aws')
   * @param variables - Input variables that were used during apply
   *
   * @throws {InfraError} If destroy fails
   */
  async destroyModule(
    moduleName: string,
    variables: Record<string, any>
  ): Promise<void> {
    const modulePath = this.resolveModulePath(moduleName);

    // In a real implementation this would shell out to `terraform destroy`.
    this.logger?.info?.(`Destroying Terraform module: ${moduleName}`, { variables });
  }

  /**
   * Validate that a Terraform module exists and is compatible
   * 
   * @param modulePath - Path to the Terraform module to validate
   * @returns Promise that resolves to true if module is valid, false otherwise
   * 
   * @remarks
   * This method checks:
   * 1. The module directory exists
   * 2. The module contains at least a main.tf file
   * 
   * @throws {InfraError} If the module path is invalid or module is incompatible
   * 
   * @example
   * ```typescript
   * const isValid = await iacIntegration.validateModule('../iac/modules/networking');
   * if (!isValid) {
   *   console.error('Module validation failed');
   * }
   * ```
   */
  async validateModule(modulePath: string): Promise<boolean> {
    try {
      // Check if module directory exists
      const moduleExists = await this.checkPathExists(modulePath);
      if (!moduleExists) {
        throw new InfraError(
          `Terraform module not found at path: ${modulePath}`,
          ErrorCode.IAC_MODULE_NOT_FOUND,
          { modulePath }
        );
      }

      // Check if module directory is actually a directory
      const stats = await fs.promises.stat(modulePath);
      if (!stats.isDirectory()) {
        throw new InfraError(
          `Module path is not a directory: ${modulePath}`,
          ErrorCode.IAC_MODULE_INVALID,
          { modulePath }
        );
      }

      // Check if module contains main.tf file (basic compatibility check)
      const mainTfPath = path.join(modulePath, 'main.tf');
      const mainTfExists = await this.checkPathExists(mainTfPath);
      if (!mainTfExists) {
        throw new InfraError(
          `Terraform module is invalid: missing main.tf file in ${modulePath}`,
          ErrorCode.IAC_MODULE_INVALID,
          { modulePath, missingFile: 'main.tf' }
        );
      }

      return true;
    } catch (error) {
      if (error instanceof InfraError) {
        throw error;
      }
      
      throw new InfraError(
        `Failed to validate Terraform module: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.IAC_MODULE_INVALID,
        { modulePath, originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Resolve the full path to a module
   * 
   * @param moduleName - Name of the module (e.g., 'networking', 'compute')
   * @returns Full path to the module
   * 
   * @private
   */
  private resolveModulePath(moduleName: string): string {
    return path.join(this.iacModulesPath, 'modules', moduleName);
  }

  /**
   * Check if a path exists
   * 
   * @param checkPath - Path to check
   * @returns Promise that resolves to true if path exists, false otherwise
   * 
   * @private
   */
  private async checkPathExists(checkPath: string): Promise<boolean> {
    try {
      await fs.promises.access(checkPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}
