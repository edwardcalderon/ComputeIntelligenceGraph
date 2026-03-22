import * as fs from 'node:fs';
import * as path from 'node:path';
import { NodeConfig, NodeIdentity, RuntimeStatus } from '@cig/runtime-contracts';

export interface NodeRuntimePaths {
  configFile: string;
  identityFile: string;
  statusFile: string;
}

export class NodeConfigStore {
  constructor(private readonly paths: NodeRuntimePaths) {}

  loadConfig(): NodeConfig {
    return this.readJson<NodeConfig>(this.paths.configFile);
  }

  saveConfig(config: NodeConfig): void {
    this.writeJson(this.paths.configFile, config);
  }

  loadIdentity(): NodeIdentity | null {
    return this.readJson<NodeIdentity | null>(this.paths.identityFile, null);
  }

  saveIdentity(identity: NodeIdentity): void {
    this.writeJson(this.paths.identityFile, identity);
  }

  loadStatus(): RuntimeStatus | null {
    return this.readJson<RuntimeStatus | null>(this.paths.statusFile, null);
  }

  saveStatus(status: RuntimeStatus): void {
    this.writeJson(this.paths.statusFile, status);
  }

  private readJson<T>(filePath: string, fallback?: T): T {
    if (!fs.existsSync(filePath)) {
      if (fallback !== undefined) {
        return fallback;
      }

      throw new Error(`Required runtime file not found: ${filePath}`);
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  }

  private writeJson(filePath: string, data: unknown): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  }
}
