import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

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

interface AuthFile {
  tokens?: AuthTokens;
  identity?: TargetIdentity;
  bootstrapToken?: BootstrapToken;
}

interface ConfigFile {
  credentials: Record<string, EncryptedCredential>;
}

export class CredentialManager {
  private readonly configDir: string;
  private readonly configFile: string;
  private readonly encryptionKey: Buffer;

  constructor() {
    this.configDir = path.join(os.homedir(), '.cig');
    this.configFile = path.join(this.configDir, 'config.json');
    this.encryptionKey = crypto
      .createHash('sha256')
      .update(os.hostname() + os.userInfo().username)
      .digest();
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

  private readConfig(): ConfigFile {
    if (!fs.existsSync(this.configFile)) {
      return { credentials: {} };
    }
    const raw = fs.readFileSync(this.configFile, 'utf8');
    return JSON.parse(raw) as ConfigFile;
  }

  private writeConfig(config: ConfigFile): void {
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

  // ── Auth file helpers ────────────────────────────────────────────────────

  private get authFile(): string {
    return path.join(this.configDir, 'auth.json');
  }

  private readAuthFile(): AuthFile {
    if (!fs.existsSync(this.authFile)) return {};
    return JSON.parse(fs.readFileSync(this.authFile, 'utf8')) as AuthFile;
  }

  private writeAuthFile(data: AuthFile): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { mode: 0o700, recursive: true });
    }
    fs.writeFileSync(this.authFile, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  saveTokens(tokens: AuthTokens): void {
    this.writeAuthFile({ ...this.readAuthFile(), tokens });
  }

  loadTokens(): AuthTokens | null {
    return this.readAuthFile().tokens ?? null;
  }

  needsRefresh(tokens: AuthTokens): boolean {
    return tokens.expiresAt < Date.now() + 5 * 60 * 1000;
  }

  isRefreshTokenValid(tokens: AuthTokens): boolean {
    return tokens.refreshExpiresAt > Date.now();
  }

  saveIdentity(identity: TargetIdentity): void {
    this.writeAuthFile({ ...this.readAuthFile(), identity });
  }

  loadIdentity(): TargetIdentity | null {
    return this.readAuthFile().identity ?? null;
  }

  saveBootstrapToken(bootstrapToken: BootstrapToken): void {
    this.writeAuthFile({ ...this.readAuthFile(), bootstrapToken });
  }

  loadBootstrapToken(): BootstrapToken | null {
    return this.readAuthFile().bootstrapToken ?? null;
  }

  clearAll(): void {
    if (fs.existsSync(this.authFile)) fs.unlinkSync(this.authFile);
    if (fs.existsSync(this.configFile)) fs.unlinkSync(this.configFile);
  }
}
