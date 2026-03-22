import * as os from 'node:os';
import * as path from 'node:path';

export interface CliPathOptions {
  homeDir?: string;
  configDir?: string;
  installDir?: string;
}

export interface CliPaths {
  homeDir: string;
  configDir: string;
  credentialsFile: string;
  secretsFile: string;
  profilesFile: string;
  stateFile: string;
  installDir: string;
}

export function resolveCliPaths(options: CliPathOptions = {}): CliPaths {
  const homeDir = options.homeDir ?? os.homedir();
  const configDir =
    options.configDir ??
    path.join(process.env['XDG_CONFIG_HOME'] ?? path.join(homeDir, '.config'), 'cig');
  const installDir = options.installDir ?? path.join(homeDir, '.cig', 'install');

  return {
    homeDir,
    configDir,
    credentialsFile: path.join(configDir, 'credentials.json'),
    secretsFile: path.join(configDir, 'secrets.json'),
    profilesFile: path.join(configDir, 'profiles.json'),
    stateFile: path.join(configDir, 'state.json'),
    installDir,
  };
}
