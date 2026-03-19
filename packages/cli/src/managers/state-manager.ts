import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface InstallationState {
  version: string;
  mode: 'managed' | 'self-hosted';
  profile: 'core' | 'full';
  installDir: string;
  installedAt: string;
  status: 'ready' | 'running' | 'stopped' | 'degraded' | 'failed';
  services: ServiceState[];
}

export interface ServiceState {
  name: string;
  status: 'running' | 'stopped' | 'restarting' | 'unhealthy';
  containerId?: string;
}

export class StateManager {
  private readonly stateFile: string;

  constructor() {
    const configDir = path.join(os.homedir(), '.cig');
    this.stateFile = path.join(configDir, 'state.json');
  }

  async save(state: InstallationState): Promise<void> {
    const dir = path.dirname(this.stateFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { mode: 0o700, recursive: true });
    }
    fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
  }

  async load(): Promise<InstallationState | null> {
    if (!fs.existsSync(this.stateFile)) {
      return null;
    }
    const raw = fs.readFileSync(this.stateFile, 'utf8');
    return JSON.parse(raw) as InstallationState;
  }

  async update(updates: Partial<InstallationState>): Promise<void> {
    const current = await this.load();
    if (!current) {
      throw new Error('No installation state found');
    }
    await this.save({ ...current, ...updates });
  }

  async delete(): Promise<void> {
    if (fs.existsSync(this.stateFile)) {
      fs.unlinkSync(this.stateFile);
    }
  }

  async validateInstallDir(state: InstallationState): Promise<boolean> {
    return fs.existsSync(state.installDir);
  }
}
