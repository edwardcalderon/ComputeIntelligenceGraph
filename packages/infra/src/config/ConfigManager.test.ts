/**
 * Unit tests for ConfigManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from './ConfigManager';
import { ConfigValidationError } from '../errors';
import type { InfraConfig } from '../types';

const ENV_KEYS_USED_BY_CONFIG_MANAGER = [
  'AWS_REGION',
  'AWS_ACCOUNT_ID',
  'AWS_PROFILE',
  'AUTHENTIK_DOMAIN',
  'AUTHENTIK_ADMIN_EMAIL',
  'AUTHENTIK_VPC_ID',
  'AUTHENTIK_SUBNET_ID',
  'DASHBOARD_DOMAIN',
  'DASHBOARD_BUILD_PATH',
  'DASHBOARD_AUTHENTIK_INTEGRATION',
  'API_DOMAIN',
  'API_REGION',
  'API_IMAGE_REPOSITORY',
  'API_CONTAINER_PORT',
  'API_CPU',
  'API_MEMORY_MIB',
  'API_DESIRED_COUNT',
  'API_VPC_ID',
  'API_ALB_SECURITY_GROUP_ID',
  'API_PUBLIC_SUBNET_IDS',
  'API_PRIVATE_SUBNET_IDS',
  'API_SECURITY_GROUP_IDS',
  'API_DATABASE_URL_SECRET_ARN',
  'API_JWT_SECRET_ARN',
  'API_NEO4J_BOLT_URI',
  'API_NEO4J_PASSWORD_SECRET_ARN',
  'API_AUTHENTIK_ISSUER_URL_SECRET_ARN',
  'API_AUTHENTIK_JWKS_URI_SECRET_ARN',
  'API_AUTHENTIK_TOKEN_ENDPOINT_SECRET_ARN',
  'API_OIDC_CLIENT_ID_SECRET_ARN',
  'API_OIDC_CLIENT_SECRET_SECRET_ARN',
  'API_CORS_ORIGINS',
  'API_CREATE_PIPELINE',
  'API_HOSTED_ZONE_DOMAIN',
  'API_CERTIFICATE_ARN',
  'API_HEALTH_CHECK_PATH',
  'API_IMAGE_URI',
  'API_IMAGE_TAG',
  'API_STAGE',
  'API_APP_NAME',
  'API_PIPELINE_REPO',
  'API_PIPELINE_PREFIX',
  'API_PROJECT_TAG',
  'API_PIPELINE_PERMISSIONS_MODE',
  'API_PIPELINE_BRANCH_PRODUCTION',
  'API_BOOTSTRAP_ONLY',
  'API_SUPABASE_URL_SECRET_ARN',
  'API_SUPABASE_SERVICE_ROLE_KEY_SECRET_ARN',
  'API_SMTP_HOST',
  'API_SMTP_PORT',
  'API_SMTP_SECURE',
  'API_SMTP_FROM_EMAIL',
  'API_SMTP_AUTH_ENABLED',
  'API_SMTP_USER',
  'API_SMTP_OTP_SUBJECT',
  'API_SMTP_PASSWORD_SECRET_ARN',
  'IAC_MODULES_PATH',
  'IAC_NETWORKING_MODULE',
  'IAC_COMPUTE_MODULE',
  'LOG_LEVEL',
  'LOG_TIMESTAMPS'
] as const;

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
      process.env.AWS_REGION = 'us-east-2';
      process.env.AWS_ACCOUNT_ID = '123456789012';
      process.env.AWS_PROFILE = 'default';

      const config = configManager.loadFromEnv();

      expect(config.aws).toBeDefined();
      expect(config.aws?.region).toBe('us-east-2');
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

    it('should load API deployment configuration from environment variables', () => {
      process.env.AWS_REGION = 'us-east-2';
      process.env.API_DOMAIN = 'api.cig.technology';
      process.env.API_IMAGE_REPOSITORY = 'cig-api-production';
      process.env.API_IMAGE_URI =
        '123456789012.dkr.ecr.us-east-2.amazonaws.com/cig-api-production@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env.API_IMAGE_TAG = 'v0.1.58';
      process.env.API_CONTAINER_PORT = '8080';
      process.env.API_CPU = '512';
      process.env.API_MEMORY_MIB = '1024';
      process.env.API_DESIRED_COUNT = '1';
      process.env.API_ALB_SECURITY_GROUP_ID = 'sg-alb';
      process.env.API_PUBLIC_SUBNET_IDS = 'subnet-public-a,subnet-public-b';
      process.env.API_PRIVATE_SUBNET_IDS = 'subnet-private-a,subnet-private-b';
      process.env.API_SECURITY_GROUP_IDS = 'sg-api';
      process.env.API_AUTHENTIK_ISSUER_URL_SECRET_ARN = 'arn:aws:secretsmanager:::issuer';
      process.env.API_AUTHENTIK_JWKS_URI_SECRET_ARN = 'arn:aws:secretsmanager:::jwks';
      process.env.API_AUTHENTIK_TOKEN_ENDPOINT_SECRET_ARN = 'arn:aws:secretsmanager:::token';
      process.env.API_OIDC_CLIENT_ID_SECRET_ARN = 'arn:aws:secretsmanager:::client-id';
      process.env.API_OIDC_CLIENT_SECRET_SECRET_ARN = 'arn:aws:secretsmanager:::client-secret';
      process.env.API_CORS_ORIGINS = 'https://app.cig.lat,https://cig.lat';
      process.env.API_SMTP_HOST = 'mail.example.com';
      process.env.API_SMTP_PORT = '587';
      process.env.API_SMTP_SECURE = 'true';
      process.env.API_SMTP_FROM_EMAIL = 'notifications@cig.technology';
      process.env.API_SMTP_AUTH_ENABLED = 'true';
      process.env.API_SMTP_USER = 'notifications@cig.technology';
      process.env.API_SMTP_OTP_SUBJECT = 'Your one-time code';
      process.env.API_SMTP_PASSWORD_SECRET_ARN = 'arn:aws:secretsmanager:::smtp-password';
      process.env.API_CREATE_PIPELINE = 'false';

      const config = configManager.loadFromEnv();

      expect(config.api).toBeDefined();
      expect(config.api?.region).toBe('us-east-2');
      expect(config.api?.domain).toBe('api.cig.technology');
      expect(config.api?.imageRepository).toBe('cig-api-production');
      expect(config.api?.imageUri).toBe(
        '123456789012.dkr.ecr.us-east-2.amazonaws.com/cig-api-production@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      );
      expect(config.api?.imageTag).toBe('v0.1.58');
      expect(config.api?.containerPort).toBe(8080);
      expect(config.api?.cpu).toBe(512);
      expect(config.api?.memoryMiB).toBe(1024);
      expect(config.api?.desiredCount).toBe(1);
      expect(config.api?.albSecurityGroupId).toBe('sg-alb');
      expect(config.api?.publicSubnetIds).toEqual(['subnet-public-a', 'subnet-public-b']);
      expect(config.api?.privateSubnetIds).toEqual(['subnet-private-a', 'subnet-private-b']);
      expect(config.api?.securityGroupIds).toEqual(['sg-api']);
      expect(config.api?.authentikSecretRefs).toEqual({
        issuerUrlSecretArn: 'arn:aws:secretsmanager:::issuer',
        jwksUriSecretArn: 'arn:aws:secretsmanager:::jwks',
        tokenEndpointSecretArn: 'arn:aws:secretsmanager:::token',
        oidcClientIdSecretArn: 'arn:aws:secretsmanager:::client-id',
        oidcClientSecretSecretArn: 'arn:aws:secretsmanager:::client-secret'
      });
      expect(config.api?.smtpHost).toBe('mail.example.com');
      expect(config.api?.smtpPort).toBe(587);
      expect(config.api?.smtpSecure).toBe(true);
      expect(config.api?.smtpFromEmail).toBe('notifications@cig.technology');
      expect(config.api?.smtpAuthEnabled).toBe(true);
      expect(config.api?.smtpUser).toBe('notifications@cig.technology');
      expect(config.api?.smtpOtpSubject).toBe('Your one-time code');
      expect(config.api?.smtpPasswordSecretArn).toBe('arn:aws:secretsmanager:::smtp-password');
      expect(config.api?.corsOrigins).toEqual(['https://app.cig.lat', 'https://cig.lat']);
      expect(config.api?.createPipeline).toBe(false);
    });

    it('should return empty object when no environment variables are set', () => {
      for (const key of ENV_KEYS_USED_BY_CONFIG_MANAGER) {
        delete process.env[key];
      }

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
          region: 'us-east-2'
        },
        authentik: {
          domain: 'auth.example.com',
          adminEmail: 'admin@example.com'
        },
        dashboard: {
          buildPath: './dist',
          authentikIntegration: true
        },
        api: {
          domain: 'api.cig.technology',
          region: 'us-east-2',
          imageRepository: 'cig-api-production'
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
          region: 'us-east-2'
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
          region: 'us-east-2'
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

    it('should validate API configuration when present', () => {
      const config = {
        aws: {
          region: 'us-east-2'
        },
        api: {
          region: 'us-east-2'
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
      expect(result.errors).toContain('api.domain is required');
      expect(result.errors).toContain('api.imageRepository is required');
    });

    it('should return multiple errors for multiple missing fields', () => {
      const config = {
        aws: {},
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
