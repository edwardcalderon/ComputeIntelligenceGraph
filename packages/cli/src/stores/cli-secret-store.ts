import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CliPathOptions, resolveCliPaths } from '../storage/paths.js';

interface EncryptedPayload {
  iv: string;
  tag: string;
  data: string;
}

interface SecretStoreFile {
  entries: Record<string, EncryptedPayload>;
}

export interface CliSecretStoreOptions {
  paths?: CliPathOptions;
  encryptionSeed?: string;
}

export class CliSecretStore {
  private readonly filePath: string;
  private readonly configDir: string;
  private readonly encryptionKey: Buffer;

  constructor(options: CliSecretStoreOptions = {}) {
    const paths = resolveCliPaths(options.paths);
    this.filePath = paths.secretsFile;
    this.configDir = paths.configDir;
    const seed = options.encryptionSeed ?? `${os.hostname()}:${os.userInfo().username}`;
    this.encryptionKey = crypto.createHash('sha256').update(seed).digest();
  }

  set<T>(key: string, value: T): void {
    const current = this.readFile();
    current.entries[key] = this.encrypt(JSON.stringify(value));
    this.writeFile(current);
  }

  get<T>(key: string): T | null {
    const current = this.readFile();
    const payload = current.entries[key];
    if (!payload) {
      return null;
    }

    return JSON.parse(this.decrypt(payload)) as T;
  }

  delete(key: string): void {
    const current = this.readFile();
    delete current.entries[key];
    this.writeFile(current);
  }

  clear(): void {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }

  private readFile(): SecretStoreFile {
    if (!fs.existsSync(this.filePath)) {
      return { entries: {} };
    }

    return JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as SecretStoreFile;
  }

  private writeFile(data: SecretStoreFile): void {
    fs.mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  private encrypt(value: string): EncryptedPayload {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return {
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
      data: encrypted.toString('hex'),
    };
  }

  private decrypt(payload: EncryptedPayload): string {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(payload.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));

    return Buffer.concat([
      decipher.update(Buffer.from(payload.data, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }
}
