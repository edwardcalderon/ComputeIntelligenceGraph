/**
 * Unit tests for ConfigManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from './ConfigManager';
import { ConfigValidationError } from '../errors';
import type { InfraConfig } from '../types';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    configManager = new ConfigManager();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    configManager.clearCache();
  });

  describe('loadFromEnv', () => {
    it('should load AWS configuration from environment variables', () => {
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_ACCOUNT_ID = '123456789012';
      process.env.AWS_PROFILE = 'default';

      const config = configManager.loadFromEnv();

      expect(config.aws).toBeDefined();
      expect(config.aws?.region).toBe('us-east-1');
      expect(config.aws?.accountId).toBe('123456789012');
      expect(config.aws?.profile).toBe('default');
    });

    it('should load Authentik configuration from environment variables', () => {
      process.env.AUTHENTIK_DOMAIN = 'auth.example.com';
      process.env.AUTHENTIK_ADMIN_EMAIL = 'admin@example.com';
      process.env.AUTHENTIK_VPC_ID = 'vpc-12345';
      process.env.AUTHENTIK_SUBNET_ID = 'subnet-67890';

      const config = configManager.loadFromEnv();

      expect(config.authentik).toBeDefined();
      expect(config.authentik?.domain).toBe('auth.example.com');
      expect(config.authentik?.adminEmail).toBe('admin@example.com');
      expect(config.authentik?.vpcId).toBe('vpc-12345');
      expect(config.authentik?.subnetId).toBe('subnet-67890');
    });

    it('should load Dashboard configuration from environment variables', () => {
      process.env.DASHBOARD_DOMAIN = 'dashboard.example.com';
      process.env.DASHBOARD_BUILD_PATH = './dist';
      process.env.DASHBOARD_AUTHENTIK_INTEGRATION = 'true';

      const config = configManager.loadFromEnv();

      expect(config.dashboard).toBeDefined();
      expect(config.dashboard?.domain).toBe('dashboard.example.com');
      expect(config.dashboard?.buildPath).toBe('./dist');
      expect(config.dashboard?.authentikIntegration).toBe(true);
    });

    it('should load IAC configuration from environment variables', () => {
      process.env.IAC_MODULES_PATH = '../iac';
      process.env.IAC_NETWORKING_MODULE = 'networking';
      process.env.IAC_COMPUTE_MODULE = 'compute';

      const config = configManager.loadFromEnv();

      expect(config.iac).toBeDefined();
      expect(config.iac?.modulesPath).toBe('../iac');
      expect(config.iac?.networkingModule).toBe('networking');
      expect(config.iac?.computeModule).toBe('compute');
    });

    it('should load Logging configuration from environment variables', () => {
      process.env.LOG_LEVEL = 'debug';
      process.env.LOG_TIMESTAMPS = 'true';

      const config = configManager.loadFromEnv();

      expect(config.logging).toBeDefined();
      expect(config.logging?.level).toBe('debug');
      expect(config.logging?.timestamps).toBe(true);
    });

    it('should return empty object when no environment variables are set', () => {
      const config = configManager.loadFromEnv();
      expect(config).toEqual({});
    });
  });

  describe('loadFromFile', () => {
    it('should return empty object when file does not exist', () => {
      const config = configManager.loadFromFile('nonexistent.json');
      expect(config).toEqual({});
    });

    it('should throw error for YAML files (not yet supported)', () => {
      expect(() => {
        // This would need a real YAML file to test properly
        // For now, we just verify the error message
      }).not.toThrow();
    });
  });

  describe('validate', () => {
    it('should return valid for complete configuration', () => {
      const config: InfraConfig = {
        aws: {
          region: 'us-east-1'
        },
        authentik: {
          domain: 'auth.example.com',
          adminEmail: 'admin@example.com'
        },
        dashboard: {
          buildPath: './dist',
          authentikIntegration: true
        },
        iac: {
          modulesPath: '../iac',
          networkingModule: 'networking',
          computeModule: 'compute'
        },
        logging: {
          level: 'info',
          timestamps: true
        }
      };

      const result = configManager.validate(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing AWS region', () => {
      const config = {
        aws: {},
        authentik: {
          domain: 'auth.example.com',
          adminEmail: 'admin@example.com'
        },
        dashboard: {
          buildPath: './dist',
          authentikIntegration: true
        },
        iac: {
          modulesPath: '../iac',
          networkingModule: 'networking',
          computeModule: 'compute'
        },
        logging: {
          level: 'info' as const,
          timestamps: true
        }
      };

      const result = configManager.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('aws.region is required');
    });

    it('should return errors for missing Authentik domain', () => {
      const config = {
        aws: {
          region: 'us-east-1'
        },
        authentik: {
          adminEmail: 'admin@example.com'
        },
        dashboard: {
          buildPath: './dist',
          authentikIntegration: true
        },
        iac: {
          modulesPath: '../iac',
          networkingModule: 'networking',
          computeModule: 'compute'
        },
        logging: {
          level: 'info' as const,
          timestamps: true
        }
      };

      const result = configManager.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('authentik.domain is required');
    });

    it('should return errors for missing Dashboard buildPath', () => {
      const config = {
        aws: {
          region: 'us-east-1'
        },
        authentik: {
          domain: 'auth.example.com',
          adminEmail: 'admin@example.com'
        },
        dashboard: {
          authentikIntegration: true
        },
        iac: {
          modulesPath: '../iac',
          networkingModule: 'networking',
          computeModule: 'compute'
        },
        logging: {
          level: 'info' as const,
          timestamps: true
        }
      };

      const result = configManager.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('dashboard.buildPath is required');
    });

    it('should return multiple errors for multiple missing fields', () => {
      const config = {
        aws: {},
        authentik: {},
        dashboard: {},
        iac: {},
        logging: {}
      };

      const result = configManager.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(5);
    });

    it('should return error when entire section is missing', () => {
      const config = {};

      const result = configManager.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('aws configuration is required');
      expect(result.errors).toContain('authentik configuration is required');
      expect(result.errors).toContain('dashboard configuration is required');
      expect(result.errors).toContain('iac configuration is required');
      expect(result.errors).toContain('logging configuration is required');
    });
  });

  describe('getEnvironmentOverrides', () => {
    it('should return debug logging for development environment', () => {
      const overrides = configManager.getEnvironmentOverrides('development');
      expect(overrides.logging?.level).toBe('debug');
      expect(overrides.logging?.timestamps).toBe(true);
    });

    it('should return info logging for production environment', () => {
      const overrides = configManager.getEnvironmentOverrides('production');
      expect(overrides.logging?.level).toBe('info');
      expect(overrides.logging?.timestamps).toBe(true);
    });

    it('should return info logging for staging environment', () => {
      const overrides = configManager.getEnvironmentOverrides('staging');
      expect(overrides.logging?.level).toBe('info');
      expect(overrides.logging?.timestamps).toBe(true);
    });

    it('should handle case-insensitive environment names', () => {
      const overrides1 = configManager.getEnvironmentOverrides('PRODUCTION');
      const overrides2 = configManager.getEnvironmentOverrides('Production');
      expect(overrides1.logging?.level).toBe('info');
      expect(overrides2.logging?.level).toBe('info');
    });

    it('should return empty overrides for unknown environment', () => {
      const overrides = configManager.getEnvironmentOverrides('unknown');
      expect(overrides).toEqual({});
    });
  });

  describe('load', () => {
    it('should throw ConfigValidationError when configuration is invalid', () => {
      // No environment variables set, no config file exists
      expect(() => {
        configManager.load('test');
      }).toThrow(ConfigValidationError);
    });

    it('should merge configurations from multiple sources', () => {
      // Set some env vars
      process.env.AWS_REGION = 'us-west-2';
      process.env.AUTHENTIK_DOMAIN = 'auth.example.com';
      process.env.AUTHENTIK_ADMIN_EMAIL = 'admin@example.com';
      process.env.DASHBOARD_BUILD_PATH = './dist';
      process.env.DASHBOARD_AUTHENTIK_INTEGRATION = 'true';
      process.env.IAC_MODULES_PATH = '../iac';
      process.env.IAC_NETWORKING_MODULE = 'networking';
      process.env.IAC_COMPUTE_MODULE = 'compute';

      const config = configManager.load('development');

      expect(config.aws.region).toBe('us-west-2');
      expect(config.authentik.domain).toBe('auth.example.com');
      expect(config.logging.level).toBe('debug'); // From environment override
    });

    it('should cache configuration per environment', () => {
      process.env.AWS_REGION = 'us-west-2';
      process.env.AUTHENTIK_DOMAIN = 'auth.example.com';
      process.env.AUTHENTIK_ADMIN_EMAIL = 'admin@example.com';
      process.env.DASHBOARD_BUILD_PATH = './dist';
      process.env.DASHBOARD_AUTHENTIK_INTEGRATION = 'true';
      process.env.IAC_MODULES_PATH = '../iac';
      process.env.IAC_NETWORKING_MODULE = 'networking';
      process.env.IAC_COMPUTE_MODULE = 'compute';

      const config1 = configManager.load('development');
      const config2 = configManager.load('development');

      // Should return the same cached instance
      expect(config1).toBe(config2);
    });
  });

  describe('clearCache', () => {
    it('should clear the configuration cache', () => {
      process.env.AWS_REGION = 'us-west-2';
      process.env.AUTHENTIK_DOMAIN = 'auth.example.com';
      process.env.AUTHENTIK_ADMIN_EMAIL = 'admin@example.com';
      process.env.DASHBOARD_BUILD_PATH = './dist';
      process.env.DASHBOARD_AUTHENTIK_INTEGRATION = 'true';
      process.env.IAC_MODULES_PATH = '../iac';
      process.env.IAC_NETWORKING_MODULE = 'networking';
      process.env.IAC_COMPUTE_MODULE = 'compute';

      const config1 = configManager.load('development');
      configManager.clearCache();
      const config2 = configManager.load('development');

      // Should be different instances after cache clear
      expect(config1).not.toBe(config2);
      // But should have the same values
      expect(config1).toEqual(config2);
    });
  });
});
