import * as fs from 'node:fs';
import * as path from 'node:path';
import { NodeConfig, NodeIdentity } from '../types/runtime.js';
import { renderSystemdUnit } from '../utils/systemd.js';

export interface NodeBundleInstallerResult {
  configPath: string;
  identityPath: string;
  systemdUnitPath: string;
}

export class NodeBundleInstaller {
  constructor(private readonly installRoot: string) {}

  writeBundle(config: NodeConfig, identity: NodeIdentity): NodeBundleInstallerResult {
    const runtimeDir = path.join(this.installRoot, 'node-runtime');
    const configPath = path.join(runtimeDir, 'config.json');
    const identityPath = path.join(runtimeDir, 'identity.json');
    const systemdUnitPath = path.join(runtimeDir, 'cig-node.service');

    fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
    fs.writeFileSync(identityPath, JSON.stringify(identity, null, 2), { mode: 0o600 });
    fs.writeFileSync(
      systemdUnitPath,
      renderSystemdUnit({
        workingDirectory: runtimeDir,
        execStart: '/usr/bin/env cig-node',
      }),
      { mode: 0o644 }
    );

    return {
      configPath,
      identityPath,
      systemdUnitPath,
    };
  }
}
