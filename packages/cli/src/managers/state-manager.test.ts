import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StateManager, InstallationState } from './state-manager.js';

describe('StateManager', () => {
  let stateManager: StateManager;
  let testStateFile: string;

  beforeEach(() => {
    stateManager = new StateManager();
    const configDir = path.join(os.homedir(), '.cig');
    testStateFile = path.join(configDir, 'state.json');
  });

  afterEach(async () => {
    // Clean up test state file
    await stateManager.delete();
  });

  describe('save and load', () => {
    it('should save and load installation state', async () => {
      const state: InstallationState = {
        version: '1.0.0',
        mode: 'managed',
        profile: 'core',
        installDir: '/home/user/.cig/install',
        installedAt: new Date().toISOString(),
        status: 'ready',
        services: [
          { name: 'api', status: 'running', containerId: 'abc123' },
          { name: 'neo4j', status: 'running', containerId: 'def456' }
        ]
      };

      await stateManager.save(state);
      const loaded = await stateManager.load();

      expect(loaded).toEqual(state);
    });

    it('should return null when no state file exists', async () => {
      const loaded = await stateManager.load();
      expect(loaded).toBeNull();
    });

    it('should create config directory if it does not exist', async () => {
      const configDir = path.dirname(testStateFile);
      
      // Remove directory if it exists
      if (fs.existsSync(testStateFile)) {
        fs.unlinkSync(testStateFile);
      }

      const state: InstallationState = {
        version: '1.0.0',
        mode: 'self-hosted',
        profile: 'full',
        installDir: '/home/user/.cig/install',
        installedAt: new Date().toISOString(),
        status: 'running',
        services: []
      };

      await stateManager.save(state);

      expect(fs.existsSync(configDir)).toBe(true);
      expect(fs.existsSync(testStateFile)).toBe(true);
    });

    it('should set file permissions to 0600', async () => {
      const state: InstallationState = {
        version: '1.0.0',
        mode: 'managed',
        profile: 'core',
        installDir: '/home/user/.cig/install',
        installedAt: new Date().toISOString(),
        status: 'ready',
        services: []
      };

      await stateManager.save(state);

      // Skip permission check on Windows
      if (process.platform !== 'win32') {
        const stats = fs.statSync(testStateFile);
        const mode = stats.mode & 0o777;
        expect(mode).toBe(0o600);
      }
    });
  });

  describe('update', () => {
    it('should update existing state', async () => {
      const initialState: InstallationState = {
        version: '1.0.0',
        mode: 'managed',
        profile: 'core',
        installDir: '/home/user/.cig/install',
        installedAt: new Date().toISOString(),
        status: 'ready',
        services: []
      };

      await stateManager.save(initialState);

      await stateManager.update({
        status: 'running',
        services: [{ name: 'api', status: 'running' }]
      });

      const updated = await stateManager.load();
      expect(updated?.status).toBe('running');
      expect(updated?.services).toHaveLength(1);
      expect(updated?.version).toBe('1.0.0'); // Unchanged fields preserved
    });

    it('should throw error when updating non-existent state', async () => {
      await expect(stateManager.update({ status: 'running' }))
        .rejects.toThrow('No installation state found');
    });
  });

  describe('delete', () => {
    it('should delete state file', async () => {
      const state: InstallationState = {
        version: '1.0.0',
        mode: 'managed',
        profile: 'core',
        installDir: '/home/user/.cig/install',
        installedAt: new Date().toISOString(),
        status: 'ready',
        services: []
      };

      await stateManager.save(state);
      expect(fs.existsSync(testStateFile)).toBe(true);

      await stateManager.delete();
      expect(fs.existsSync(testStateFile)).toBe(false);
    });

    it('should not throw error when deleting non-existent state', async () => {
      await expect(stateManager.delete()).resolves.not.toThrow();
    });
  });

  describe('validateInstallDir', () => {
    it('should return true when install directory exists', async () => {
      const state: InstallationState = {
        version: '1.0.0',
        mode: 'managed',
        profile: 'core',
        installDir: os.homedir(), // Use home directory which always exists
        installedAt: new Date().toISOString(),
        status: 'ready',
        services: []
      };

      const isValid = await stateManager.validateInstallDir(state);
      expect(isValid).toBe(true);
    });

    it('should return false when install directory does not exist', async () => {
      const state: InstallationState = {
        version: '1.0.0',
        mode: 'managed',
        profile: 'core',
        installDir: '/nonexistent/directory/path',
        installedAt: new Date().toISOString(),
        status: 'ready',
        services: []
      };

      const isValid = await stateManager.validateInstallDir(state);
      expect(isValid).toBe(false);
    });
  });
});
