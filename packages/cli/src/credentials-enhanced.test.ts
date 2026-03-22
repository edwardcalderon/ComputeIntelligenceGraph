import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CredentialManager, AuthTokens, TargetIdentity, BootstrapToken } from './credentials.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('CredentialManager - Enhanced Features', () => {
  let manager: CredentialManager;
  let tmpDir: string;
  let testSecretsFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cig-credentials-'));
    manager = new CredentialManager({
      paths: {
        configDir: path.join(tmpDir, 'config'),
      },
      encryptionSeed: 'test-seed',
    });
    testSecretsFile = path.join(tmpDir, 'config', 'secrets.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('AuthTokens', () => {
    it('should save and load auth tokens', () => {
      const tokens: AuthTokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600000, // 1 hour from now
        refreshExpiresAt: Date.now() + 86400000, // 24 hours from now
      };

      manager.saveTokens(tokens);
      const loaded = manager.loadTokens();

      expect(loaded).not.toBeNull();
      expect(loaded?.accessToken).toBe(tokens.accessToken);
      expect(loaded?.refreshToken).toBe(tokens.refreshToken);
      expect(loaded?.expiresAt).toBe(tokens.expiresAt);
      expect(loaded?.refreshExpiresAt).toBe(tokens.refreshExpiresAt);
    });

    it('should return null when no tokens are stored', () => {
      const loaded = manager.loadTokens();
      expect(loaded).toBeNull();
    });

    it('should check if token needs refresh', () => {
      const tokensNeedRefresh: AuthTokens = {
        accessToken: 'test',
        refreshToken: 'test',
        expiresAt: Date.now() + 60000, // 1 minute from now (less than 5 minutes)
        refreshExpiresAt: Date.now() + 86400000,
      };

      const tokensNoRefresh: AuthTokens = {
        accessToken: 'test',
        refreshToken: 'test',
        expiresAt: Date.now() + 600000, // 10 minutes from now
        refreshExpiresAt: Date.now() + 86400000,
      };

      expect(manager.needsRefresh(tokensNeedRefresh)).toBe(true);
      expect(manager.needsRefresh(tokensNoRefresh)).toBe(false);
    });

    it('should check if refresh token is valid', () => {
      const validTokens: AuthTokens = {
        accessToken: 'test',
        refreshToken: 'test',
        expiresAt: Date.now() + 3600000,
        refreshExpiresAt: Date.now() + 86400000, // Future date
      };

      const expiredTokens: AuthTokens = {
        accessToken: 'test',
        refreshToken: 'test',
        expiresAt: Date.now() - 3600000,
        refreshExpiresAt: Date.now() - 1000, // Past date
      };

      expect(manager.isRefreshTokenValid(validTokens)).toBe(true);
      expect(manager.isRefreshTokenValid(expiredTokens)).toBe(false);
    });
  });

  describe('TargetIdentity', () => {
    it('should save and load target identity', () => {
      const identity: TargetIdentity = {
        targetId: 'test-target-id',
        publicKey: 'test-public-key',
        privateKey: 'test-private-key',
        enrolledAt: new Date().toISOString(),
      };

      manager.saveIdentity(identity);
      const loaded = manager.loadIdentity();

      expect(loaded).not.toBeNull();
      expect(loaded?.targetId).toBe(identity.targetId);
      expect(loaded?.publicKey).toBe(identity.publicKey);
      expect(loaded?.privateKey).toBe(identity.privateKey);
      expect(loaded?.enrolledAt).toBe(identity.enrolledAt);
    });

    it('should return null when no identity is stored', () => {
      const loaded = manager.loadIdentity();
      expect(loaded).toBeNull();
    });
  });

  describe('BootstrapToken', () => {
    it('should save and load bootstrap token', () => {
      const token: BootstrapToken = {
        token: 'test-bootstrap-token-12345678',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1800000).toISOString(), // 30 minutes
      };

      manager.saveBootstrapToken(token);
      const loaded = manager.loadBootstrapToken();

      expect(loaded).not.toBeNull();
      expect(loaded?.token).toBe(token.token);
      expect(loaded?.createdAt).toBe(token.createdAt);
      expect(loaded?.expiresAt).toBe(token.expiresAt);
    });

    it('should return null when no bootstrap token is stored', () => {
      const loaded = manager.loadBootstrapToken();
      expect(loaded).toBeNull();
    });
  });

  describe('Multiple credentials in auth file', () => {
    it('should store tokens, identity, and bootstrap token independently', () => {
      const tokens: AuthTokens = {
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 3600000,
        refreshExpiresAt: Date.now() + 86400000,
      };

      const identity: TargetIdentity = {
        targetId: 'target-123',
        publicKey: 'pub-key',
        privateKey: 'priv-key',
        enrolledAt: new Date().toISOString(),
      };

      const bootstrap: BootstrapToken = {
        token: 'bootstrap-token',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1800000).toISOString(),
      };

      manager.saveTokens(tokens);
      manager.saveIdentity(identity);
      manager.saveBootstrapToken(bootstrap);

      const loadedTokens = manager.loadTokens();
      const loadedIdentity = manager.loadIdentity();
      const loadedBootstrap = manager.loadBootstrapToken();

      expect(loadedTokens?.accessToken).toBe(tokens.accessToken);
      expect(loadedIdentity?.targetId).toBe(identity.targetId);
      expect(loadedBootstrap?.token).toBe(bootstrap.token);
    });
  });

  describe('clearAll', () => {
    it('should remove all credential files', () => {
      const tokens: AuthTokens = {
        accessToken: 'test',
        refreshToken: 'test',
        expiresAt: Date.now() + 3600000,
        refreshExpiresAt: Date.now() + 86400000,
      };

      manager.saveTokens(tokens);
      expect(fs.existsSync(testSecretsFile)).toBe(true);

      manager.clearAll();
      expect(fs.existsSync(testSecretsFile)).toBe(false);
    });
  });

  describe('File permissions', () => {
    it('should create secrets.json with 0600 permissions', () => {
      const tokens: AuthTokens = {
        accessToken: 'test',
        refreshToken: 'test',
        expiresAt: Date.now() + 3600000,
        refreshExpiresAt: Date.now() + 86400000,
      };

      manager.saveTokens(tokens);

      const stats = fs.statSync(testSecretsFile);
      const mode = stats.mode & 0o777;
      
      // On Unix-like systems, should be 0600
      if (process.platform !== 'win32') {
        expect(mode).toBe(0o600);
      }
    });
  });
});
