import * as fs from 'node:fs';
import * as path from 'node:path';
import { CliPathOptions, resolveCliPaths } from '../storage/paths.js';
import { ConnectionProfile } from '../types/runtime.js';

interface ConnectionProfileFile {
  defaultProfileId?: string;
  profiles: ConnectionProfile[];
}

export class ConnectionProfileStore {
  private readonly filePath: string;

  constructor(pathOptions: CliPathOptions = {}) {
    this.filePath = resolveCliPaths(pathOptions).profilesFile;
  }

  list(): ConnectionProfile[] {
    return this.readFile().profiles;
  }

  get(profileId: string): ConnectionProfile | null {
    return this.list().find((profile) => profile.id === profileId) ?? null;
  }

  getDefault(): ConnectionProfile | null {
    const file = this.readFile();
    if (!file.defaultProfileId) {
      return file.profiles[0] ?? null;
    }

    return file.profiles.find((profile) => profile.id === file.defaultProfileId) ?? null;
  }

  save(profile: ConnectionProfile): void {
    const file = this.readFile();
    const existingIndex = file.profiles.findIndex((item) => item.id === profile.id);

    if (existingIndex >= 0) {
      file.profiles[existingIndex] = profile;
    } else {
      file.profiles.push(profile);
    }

    if (profile.isDefault || !file.defaultProfileId) {
      file.defaultProfileId = profile.id;
    }

    this.writeFile(file);
  }

  delete(profileId: string): void {
    const file = this.readFile();
    file.profiles = file.profiles.filter((profile) => profile.id !== profileId);
    if (file.defaultProfileId === profileId) {
      file.defaultProfileId = file.profiles[0]?.id;
    }
    this.writeFile(file);
  }

  setDefault(profileId: string): void {
    const file = this.readFile();
    if (!file.profiles.some((profile) => profile.id === profileId)) {
      throw new Error(`Connection profile not found: ${profileId}`);
    }

    file.defaultProfileId = profileId;
    file.profiles = file.profiles.map((profile) => ({
      ...profile,
      isDefault: profile.id === profileId,
    }));
    this.writeFile(file);
  }

  private readFile(): ConnectionProfileFile {
    if (!fs.existsSync(this.filePath)) {
      return { profiles: [] };
    }

    return JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as ConnectionProfileFile;
  }

  private writeFile(data: ConnectionProfileFile): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  }
}
