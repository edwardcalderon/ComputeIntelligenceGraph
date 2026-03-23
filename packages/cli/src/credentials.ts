import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CliPathOptions, resolveCliPaths } from './storage/paths.js';
import { CliSecretStore } from './stores/cli-secret-store.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt: number;
}

export interface TargetIdentity {
  targetId: string;
  publicKey: string;
  privateKey: string;
  enrolledAt: string;
}

export interface BootstrapToken {
  token: string;
  createdAt: string;
  expiresAt: string;
}

export interface Credential {
  type: 'aws' | 'gcp';
  value: string;
  createdAt: string;
  rotateAfterDays: number;
}

export interface EncryptedCredential {
  iv: string;
  tag: string;
  data: string;
  createdAt: string;
  rotateAfterDays: number;
  type: 'aws' | 'gcp';
}

interface CredentialConfigFile {
  credentials: Record<string, EncryptedCredential>;
}

export interface CredentialManagerOptions {
  paths?: CliPathOptions;
  encryptionSeed?: string;
  secretStore?: CliSecretStore;
}

export class CredentialManager {
  private readonly configDir: string;
  private readonly configFile: string;
  private readonly encryptionKey: Buffer;
  private readonly secretStore: CliSecretStore;

  constructor(options: CredentialManagerOptions = {}) {
    const paths = resolveCliPaths(options.paths);
    this.configDir = paths.configDir;
    this.configFile = paths.credentialsFile;
    const seed = options.encryptionSeed ?? `${os.hostname()}:${os.userInfo().username}`;
    this.encryptionKey = crypto.createHash('sha256').update(seed).digest();
    this.secretStore =
      options.secretStore ?? new CliSecretStore({ paths: options.paths, encryptionSeed: seed });
  }

  private encrypt(plaintext: string): { iv: string; tag: string; data: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      data: encrypted.toString('hex'),
    };
  }

  private decrypt(encrypted: { iv: string; tag: string; data: string }): string {
    const iv = Buffer.from(encrypted.iv, 'hex');
    const tag = Buffer.from(encrypted.tag, 'hex');
    const data = Buffer.from(encrypted.data, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  private readConfig(): CredentialConfigFile {
    if (!fs.existsSync(this.configFile)) {
      return { credentials: {} };
    }
    const raw = fs.readFileSync(this.configFile, 'utf8');
    return JSON.parse(raw) as CredentialConfigFile;
  }

  private writeConfig(config: CredentialConfigFile): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { mode: 0o700, recursive: true });
    }
    fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2), { mode: 0o600 });
  }

  save(type: 'aws' | 'gcp', value: string, rotateAfterDays = 90): void {
    if (!value || value.trim() === '') {
      throw new Error('Credential value must not be empty');
    }
    const { iv, tag, data } = this.encrypt(value);
    const config = this.readConfig();
    config.credentials[type] = {
      iv,
      tag,
      data,
      createdAt: new Date().toISOString(),
      rotateAfterDays,
      type,
    };
    this.writeConfig(config);
    console.log(`Credential saved for type: ${type}`);
  }

  load(type: 'aws' | 'gcp'): string | null {
    const config = this.readConfig();
    const entry = config.credentials[type];
    if (!entry) return null;
    return this.decrypt({ iv: entry.iv, tag: entry.tag, data: entry.data });
  }

  isRotationDue(type: 'aws' | 'gcp'): boolean {
    const config = this.readConfig();
    const entry = config.credentials[type];
    if (!entry) return false;
    const created = new Date(entry.createdAt).getTime();
    const ageMs = Date.now() - created;
    const thresholdMs = entry.rotateAfterDays * 24 * 60 * 60 * 1000;
    return ageMs >= thresholdMs;
  }

  delete(type: 'aws' | 'gcp'): void {
    const config = this.readConfig();
    delete config.credentials[type];
    this.writeConfig(config);
    console.log(`Credential deleted for type: ${type}`);
  }

  list(): Array<{ type: string; createdAt: string; rotationDue: boolean }> {
    const config = this.readConfig();
    return Object.values(config.credentials).map((entry) => ({
      type: entry.type,
      createdAt: entry.createdAt,
      rotationDue: this.isRotationDue(entry.type),
    }));
  }

  saveTokens(tokens: AuthTokens): void {
    this.secretStore.set('auth.tokens', tokens);
  }

  loadTokens(): AuthTokens | null {
    return this.secretStore.get<AuthTokens>('auth.tokens');
  }

  needsRefresh(tokens: AuthTokens): boolean {
    return tokens.expiresAt < Date.now() + 5 * 60 * 1000;
  }

  isRefreshTokenValid(tokens: AuthTokens): boolean {
    return tokens.refreshExpiresAt > Date.now();
  }

  saveIdentity(identity: TargetIdentity): void {
    this.secretStore.set('node.identity', identity);
  }

  loadIdentity(): TargetIdentity | null {
    return this.secretStore.get<TargetIdentity>('node.identity');
  }

  saveBootstrapToken(bootstrapToken: BootstrapToken): void {
    this.secretStore.set('bootstrap.token', bootstrapToken);
  }

  loadBootstrapToken(): BootstrapToken | null {
    return this.secretStore.get<BootstrapToken>('bootstrap.token');
  }

  saveSessionId(sessionId: string): void {
    this.secretStore.set('session.id', { sessionId });
  }

  loadSessionId(): string | null {
    const data = this.secretStore.get<{ sessionId: string }>('session.id');
    return data?.sessionId ?? null;
  }

  clearAll(): void {
    this.secretStore.clear();
    if (fs.existsSync(this.configFile)) fs.unlinkSync(this.configFile);
  }
}

export function createTempCredentialManager(tmpDir: string): CredentialManager {
  return new CredentialManager({
    paths: {
      configDir: path.join(tmpDir, 'config'),
      installDir: path.join(tmpDir, 'install'),
    },
    encryptionSeed: 'test-seed',
  });
}
