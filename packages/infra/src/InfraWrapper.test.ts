/**
 * Unit tests for InfraWrapper
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InfraWrapper } from './InfraWrapper';
import { ConfigManager } from './config/ConfigManager';
import type { DeploymentOptions, InfraConfig } from './types';

describe('InfraWrapper', () => {
  let configManager: ConfigManager;
  let wrapper: InfraWrapper;

  beforeEach(() => {
    configManager = new ConfigManager();
    wrapper = new InfraWrapper(configManager);
  });

  describe('constructor', () => {
    it('should create an instance with ConfigManager', () => {
      expect(wrapper).toBeInstanceOf(InfraWrapper);
    });
  });

  describe('deployAuthentik', () => {
    it('should accept deployment options and log operation', async () => {
      const options: DeploymentOptions = {
        environment: 'test',
        region: 'us-east-2'
      };

      const mockConfig: InfraConfig = {
        aws: { region: 'us-east-2' },
        authentik: {
          domain: 'auth.test.com',
          adminEmail: 'admin@test.com'
        },
        dashboard: {
          buildPath: './build',
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

      // Mock the config manager to return valid config
      vi.spyOn(configManager, 'load').mockReturnValue(mockConfig);

      const result = await wrapper.deployAuthentik(options);
      
      // Currently returns not implemented
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not yet implemented');
    });
  });

  describe('deployDashboard', () => {
    it('should accept deployment options and log operation', async () => {
      const options: DeploymentOptions = {
        environment: 'test',
        region: 'us-east-2'
      };

      const mockConfig: InfraConfig = {
        aws: { region: 'us-east-2' },
        authentik: {
          domain: 'auth.test.com',
          adminEmail: 'admin@test.com'
        },
        dashboard: {
          buildPath: './build',
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

      // Mock the config manager to return valid config
      vi.spyOn(configManager, 'load').mockReturnValue(mockConfig);

      const result = await wrapper.deployDashboard(options);
      
      // Currently returns not implemented
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not yet implemented');
    });
  });

  describe('listDeployments', () => {
    it('should accept environment parameter and return deployments', async () => {
      const mockConfig: InfraConfig = {
        aws: { region: 'us-east-2' },
        authentik: {
          domain: 'auth.test.com',
          adminEmail: 'admin@test.com'
        },
        dashboard: {
          buildPath: './build',
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

      // Mock the config manager to return valid config
      vi.spyOn(configManager, 'load').mockReturnValue(mockConfig);

      const deployments = await wrapper.listDeployments('test');
      
      // Currently returns empty array
      expect(Array.isArray(deployments)).toBe(true);
      expect(deployments.length).toBe(0);
    });
  });
});
