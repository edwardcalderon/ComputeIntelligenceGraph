import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

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
}
