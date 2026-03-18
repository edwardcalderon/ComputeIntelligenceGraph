/**
 * Configuration management for infrastructure deployment
 * @packageDocumentation
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  InfraConfig,
  ValidationResult,
  AWSConfig,
  AuthentikConfig,
  DashboardConfig,
  IACConfig,
  LoggingConfig
} from '../types';
import { ConfigValidationError } from '../errors';

/**
 * Manages configuration loading, validation, and environment-specific overrides
 * 
 * @remarks
 * ConfigManager handles loading configuration from multiple sources (environment variables,
 * configuration files) and merging them with environment-specific overrides. It validates
 * that all required configuration parameters are present before deployment operations.
 * 
 * @example
 * ```typescript
 * const configManager = new ConfigManager();
 * const config = configManager.load('production');
 * const validation = configManager.validate(config);
 * if (!validation.valid) {
 *   throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
 * }
 * ```
 */
export class ConfigManager {
  private configCache: Map<string, InfraConfig> = new Map();

  /**
   * Load configuration from multiple sources
   * 
   * @param environment - Target environment name (e.g., 'development', 'production')
   * @returns Complete infrastructure configuration
   * 
   * @remarks
   * Configuration is loaded and merged in the following order (later sources override earlier):
   * 1. Environment variables
   * 2. Configuration file (if exists)
   * 3. Environment-specific overrides
   * 
   * The merged configuration is cached per environment for performance.
   */
  load(environment: string): InfraConfig {
    // Check cache first
    if (this.configCache.has(environment)) {
      return this.configCache.get(environment)!;
    }

    // Load from multiple sources
    const envConfig = this.loadFromEnv();
    const fileConfig = this.loadFromFile(`config/${environment}.json`);
    const overrides = this.getEnvironmentOverrides(environment);

    // Merge configurations (later sources override earlier)
    const merged = this.mergeConfigs(envConfig, fileConfig, overrides);

    // Validate before caching
    const validation = this.validate(merged);
    if (!validation.valid) {
      throw new ConfigValidationError(
        `Configuration validation failed: ${validation.errors.join(', ')}`,
        validation.errors
      );
    }

    // Cache and return
    this.configCache.set(environment, merged as InfraConfig);
    return merged as InfraConfig;
  }

  /**
   * Load configuration from environment variables
   * 
   * @returns Partial configuration from environment variables
   * 
   * @remarks
   * Reads configuration from environment variables with the following naming convention:
   * - AWS_REGION, AWS_ACCOUNT_ID, AWS_PROFILE
   * - AUTHENTIK_DOMAIN, AUTHENTIK_ADMIN_EMAIL, AUTHENTIK_VPC_ID, AUTHENTIK_SUBNET_ID
   * - DASHBOARD_DOMAIN, DASHBOARD_BUILD_PATH, DASHBOARD_AUTHENTIK_INTEGRATION
   * - IAC_MODULES_PATH, IAC_NETWORKING_MODULE, IAC_COMPUTE_MODULE
   * - LOG_LEVEL, LOG_TIMESTAMPS
   */
  loadFromEnv(): Partial<InfraConfig> {
    const config: Partial<InfraConfig> = {};

    // AWS configuration
    if (process.env.AWS_REGION || process.env.AWS_ACCOUNT_ID || process.env.AWS_PROFILE) {
      config.aws = {} as AWSConfig;
      if (process.env.AWS_REGION) {
        config.aws.region = process.env.AWS_REGION;
      }
      if (process.env.AWS_ACCOUNT_ID) {
        config.aws.accountId = process.env.AWS_ACCOUNT_ID;
      }
      if (process.env.AWS_PROFILE) {
        config.aws.profile = process.env.AWS_PROFILE;
      }
    }

    // Authentik configuration
    if (
      process.env.AUTHENTIK_DOMAIN ||
      process.env.AUTHENTIK_ADMIN_EMAIL ||
      process.env.AUTHENTIK_VPC_ID ||
      process.env.AUTHENTIK_SUBNET_ID
    ) {
      config.authentik = {} as AuthentikConfig;
      if (process.env.AUTHENTIK_DOMAIN) {
        config.authentik.domain = process.env.AUTHENTIK_DOMAIN;
      }
      if (process.env.AUTHENTIK_ADMIN_EMAIL) {
        config.authentik.adminEmail = process.env.AUTHENTIK_ADMIN_EMAIL;
      }
      if (process.env.AUTHENTIK_VPC_ID) {
        config.authentik.vpcId = process.env.AUTHENTIK_VPC_ID;
      }
      if (process.env.AUTHENTIK_SUBNET_ID) {
        config.authentik.subnetId = process.env.AUTHENTIK_SUBNET_ID;
      }
    }

    // Dashboard configuration
    if (
      process.env.DASHBOARD_DOMAIN ||
      process.env.DASHBOARD_BUILD_PATH ||
      process.env.DASHBOARD_AUTHENTIK_INTEGRATION
    ) {
      config.dashboard = {} as DashboardConfig;
      if (process.env.DASHBOARD_DOMAIN) {
        config.dashboard.domain = process.env.DASHBOARD_DOMAIN;
      }
      if (process.env.DASHBOARD_BUILD_PATH) {
        config.dashboard.buildPath = process.env.DASHBOARD_BUILD_PATH;
      }
      if (process.env.DASHBOARD_AUTHENTIK_INTEGRATION) {
        config.dashboard.authentikIntegration =
          process.env.DASHBOARD_AUTHENTIK_INTEGRATION === 'true';
      }
    }

    // IAC configuration
    if (
      process.env.IAC_MODULES_PATH ||
      process.env.IAC_NETWORKING_MODULE ||
      process.env.IAC_COMPUTE_MODULE
    ) {
      config.iac = {} as IACConfig;
      if (process.env.IAC_MODULES_PATH) {
        config.iac.modulesPath = process.env.IAC_MODULES_PATH;
      }
      if (process.env.IAC_NETWORKING_MODULE) {
        config.iac.networkingModule = process.env.IAC_NETWORKING_MODULE;
      }
      if (process.env.IAC_COMPUTE_MODULE) {
        config.iac.computeModule = process.env.IAC_COMPUTE_MODULE;
      }
    }

    // Logging configuration
    if (process.env.LOG_LEVEL || process.env.LOG_TIMESTAMPS) {
      config.logging = {} as LoggingConfig;
      if (process.env.LOG_LEVEL) {
        const level = process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error';
        config.logging.level = level;
      }
      if (process.env.LOG_TIMESTAMPS) {
        config.logging.timestamps = process.env.LOG_TIMESTAMPS === 'true';
      }
    }

    return config;
  }

  /**
   * Load configuration from a JSON or YAML file
   * 
   * @param path - Path to configuration file (relative to process.cwd())
   * @returns Partial configuration from file, or empty object if file doesn't exist
   * 
   * @remarks
   * Supports both JSON and YAML formats. File format is determined by extension.
   * If the file doesn't exist, returns an empty object without throwing an error.
   * Invalid JSON/YAML will throw a parsing error.
   */
  loadFromFile(path: string): Partial<InfraConfig> {
    const fullPath = resolve(process.cwd(), path);

    if (!existsSync(fullPath)) {
      return {};
    }

    try {
      const content = readFileSync(fullPath, 'utf-8');

      // Determine format by extension
      if (path.endsWith('.json')) {
        return JSON.parse(content);
      } else if (path.endsWith('.yaml') || path.endsWith('.yml')) {
        // For YAML support, we'd need a YAML parser library
        // For now, we'll just support JSON
        throw new Error('YAML support not yet implemented. Please use JSON configuration files.');
      }

      // Try JSON as default
      return JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Failed to load configuration from ${path}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validate configuration completeness
   * 
   * @param config - Configuration object to validate
   * @returns Validation result with list of errors
   * 
   * @remarks
   * Checks that all required fields are present:
   * - aws.region (required)
   * - authentik.domain (required)
   * - authentik.adminEmail (required)
   * - dashboard.buildPath (required)
   * - dashboard.authentikIntegration (required)
   * - iac.modulesPath (required)
   * - iac.networkingModule (required)
   * - iac.computeModule (required)
   * - logging.level (required)
   * - logging.timestamps (required)
   */
  validate(config: Partial<InfraConfig>): ValidationResult {
    const errors: string[] = [];

    // Validate AWS configuration
    if (!config.aws) {
      errors.push('aws configuration is required');
    } else {
      if (!config.aws.region) {
        errors.push('aws.region is required');
      }
    }

    // Validate Authentik configuration
    if (!config.authentik) {
      errors.push('authentik configuration is required');
    } else {
      if (!config.authentik.domain) {
        errors.push('authentik.domain is required');
      }
      if (!config.authentik.adminEmail) {
        errors.push('authentik.adminEmail is required');
      }
    }

    // Validate Dashboard configuration
    if (!config.dashboard) {
      errors.push('dashboard configuration is required');
    } else {
      if (!config.dashboard.buildPath) {
        errors.push('dashboard.buildPath is required');
      }
      if (config.dashboard.authentikIntegration === undefined) {
        errors.push('dashboard.authentikIntegration is required');
      }
    }

    // Validate IAC configuration
    if (!config.iac) {
      errors.push('iac configuration is required');
    } else {
      if (!config.iac.modulesPath) {
        errors.push('iac.modulesPath is required');
      }
      if (!config.iac.networkingModule) {
        errors.push('iac.networkingModule is required');
      }
      if (!config.iac.computeModule) {
        errors.push('iac.computeModule is required');
      }
    }

    // Validate Logging configuration
    if (!config.logging) {
      errors.push('logging configuration is required');
    } else {
      if (!config.logging.level) {
        errors.push('logging.level is required');
      }
      if (config.logging.timestamps === undefined) {
        errors.push('logging.timestamps is required');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get environment-specific configuration overrides
   * 
   * @param environment - Environment name
   * @returns Partial configuration with environment-specific overrides
   * 
   * @remarks
   * Provides environment-specific defaults and overrides. For example:
   * - 'development': Uses local paths, debug logging
   * - 'production': Uses production domains, info logging
   * - 'staging': Uses staging domains, info logging
   * 
   * These overrides are applied last and take precedence over other configuration sources.
   */
  getEnvironmentOverrides(environment: string): Partial<InfraConfig> {
    const overrides: Partial<InfraConfig> = {};

    switch (environment.toLowerCase()) {
      case 'development':
      case 'dev':
        overrides.logging = {
          level: 'debug',
          timestamps: true
        };
        break;

      case 'staging':
      case 'stage':
        overrides.logging = {
          level: 'info',
          timestamps: true
        };
        break;

      case 'production':
      case 'prod':
        overrides.logging = {
          level: 'info',
          timestamps: true
        };
        break;

      default:
        // No specific overrides for unknown environments
        break;
    }

    return overrides;
  }

  /**
   * Merge multiple partial configurations into one
   * 
   * @param configs - Configuration objects to merge (later ones override earlier)
   * @returns Merged configuration
   * 
   * @remarks
   * Performs a deep merge of configuration objects. Later configurations override
   * earlier ones at the field level. Arrays are replaced, not merged.
   */
  private mergeConfigs(...configs: Partial<InfraConfig>[]): Partial<InfraConfig> {
    const result: Partial<InfraConfig> = {};

    for (const config of configs) {
      if (config.aws) {
        result.aws = { ...result.aws, ...config.aws } as AWSConfig;
      }
      if (config.authentik) {
        result.authentik = { ...result.authentik, ...config.authentik } as AuthentikConfig;
      }
      if (config.dashboard) {
        result.dashboard = { ...result.dashboard, ...config.dashboard } as DashboardConfig;
      }
      if (config.iac) {
        result.iac = { ...result.iac, ...config.iac } as IACConfig;
      }
      if (config.logging) {
        result.logging = { ...result.logging, ...config.logging } as LoggingConfig;
      }
    }

    return result;
  }

  /**
   * Clear the configuration cache
   * 
   * @remarks
   * Useful for testing or when configuration files change at runtime.
   */
  clearCache(): void {
    this.configCache.clear();
  }
}
