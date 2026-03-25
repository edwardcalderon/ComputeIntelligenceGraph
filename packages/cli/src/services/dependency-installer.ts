import { execSync } from 'node:child_process';
import * as os from 'node:os';
import type { PrereqCheckResult } from '../prereqs.js';

export interface PrereqFailureGroups {
  installable: PrereqCheckResult[];
  startable: PrereqCheckResult[];
  admin: PrereqCheckResult[];
  manual: PrereqCheckResult[];
}

export interface DependencyInstallPlan {
  platform: 'linux' | 'macos' | 'unsupported';
  packageManager?: 'apt' | 'dnf' | 'pacman' | 'brew';
  commands: string[];
  summary: string;
  requiresAdmin?: boolean;
}

export interface DockerDaemonStartPlan {
  platform: 'linux' | 'macos' | 'unsupported';
  commands: string[];
  summary: string;
  requiresAdmin?: boolean;
}

export interface DependencyInstallResult {
  attempted: boolean;
  succeeded: boolean;
  commands: string[];
  summary: string;
  error?: string;
  requiresAdmin?: boolean;
}

function normalizePlatform(platform: NodeJS.Platform): 'linux' | 'macos' | 'unsupported' {
  if (platform === 'darwin') {
    return 'macos';
  }

  if (platform === 'linux') {
    return 'linux';
  }

  return 'unsupported';
}

function hasCommand(command: string): boolean {
  try {
    execSync(`command -v ${command}`, { stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch {
    return false;
  }
}

function isRootUser(): boolean {
  return typeof process.getuid === 'function' && process.getuid() === 0;
}

function canUseSudo(): boolean {
  return isRootUser() || hasCommand('sudo');
}

function elevateLinuxCommands(commands: string[]): string[] {
  if (isRootUser()) {
    return commands;
  }

  if (!hasCommand('sudo')) {
    return [];
  }

  return commands.map((command) => `sudo ${command}`);
}

function detectLinuxPackageManager(): 'apt' | 'dnf' | 'pacman' | null {
  if (hasCommand('apt-get')) {
    return 'apt';
  }

  if (hasCommand('dnf')) {
    return 'dnf';
  }

  if (hasCommand('pacman')) {
    return 'pacman';
  }

  return null;
}

export function splitPrereqFailures(results: PrereqCheckResult[]): PrereqFailureGroups {
  const installable = results.filter(
    (result) => !result.passed && result.installGroup === 'docker' && result.remediationKind === 'install'
  );
  const startable = results.filter(
    (result) => !result.passed && result.installGroup === 'docker' && result.remediationKind === 'start'
  );
  const admin = results.filter(
    (result) => !result.passed && result.installGroup === 'docker' && result.remediationKind === 'admin'
  );
  const manual = results.filter(
    (result) =>
      !result.passed &&
      result.remediationKind !== 'install' &&
      result.remediationKind !== 'start' &&
      result.remediationKind !== 'admin'
  );

  return { installable, startable, admin, manual };
}

export function buildDependencyInstallPrompt(groups: PrereqFailureGroups): string {
  if (groups.admin.length > 0) {
    return 'Docker is installed, but this terminal does not have administrator access. Re-run this installer from a sudo-capable shell to install the remaining Docker prerequisites automatically?';
  }

  if (groups.installable.length === 0) {
    return 'Missing prerequisites can only be fixed manually. Continue with the remediation steps above?';
  }

  if (groups.startable.length > 0 && groups.manual.length === 0) {
    return 'Docker is installed but not running. Try to start the daemon and install the remaining Docker prerequisites automatically now?';
  }

  if (groups.manual.length === 0) {
    return 'Docker prerequisites are missing. Try to install them automatically now?';
  }

  return [
    'Docker prerequisites are missing, and other checks still need manual fixes.',
    'Try to install the Docker prerequisites now and then re-run the checks?',
  ].join(' ');
}

export function buildDockerDaemonStartPrompt(groups: PrereqFailureGroups): string {
  if (groups.admin.length > 0) {
    return 'Docker is installed, but this terminal does not have administrator access. Re-run this installer from a sudo-capable shell to start the Docker daemon automatically?';
  }

  if (groups.startable.length === 0) {
    return 'Docker is installed but not running. Try to initialize or start the daemon automatically now?';
  }

  if (groups.installable.length === 0 && groups.manual.length === 0) {
    return 'Docker is installed but not running. Try to start the daemon automatically now?';
  }

  return [
    'Docker is installed but not running, and additional Docker prerequisites are missing.',
    'Start the daemon now, then try to install the remaining Docker prerequisites automatically?',
  ].join(' ');
}

export function buildDependencyInstallPlan(platform = os.platform()): DependencyInstallPlan {
  const normalizedPlatform = normalizePlatform(platform);

  if (normalizedPlatform === 'unsupported') {
    return {
      platform: 'unsupported',
      commands: [],
      summary: 'Automatic dependency installation is supported only on Linux and macOS.',
    };
  }

  if (normalizedPlatform === 'macos') {
    if (!hasCommand('brew')) {
      return {
        platform: 'macos',
        packageManager: 'brew',
        commands: [],
        summary:
          'Homebrew is not available. Install Docker Desktop manually from https://www.docker.com/products/docker-desktop/.',
      };
    }

    return {
      platform: 'macos',
      packageManager: 'brew',
      commands: ['brew install --cask docker', 'open -a Docker'],
      summary: 'Installing Docker Desktop with Homebrew and opening the app once installation completes.',
    };
  }

  const packageManager = detectLinuxPackageManager();
  if (!packageManager) {
    return {
      platform: 'linux',
      commands: [],
      requiresAdmin: !canUseSudo(),
      summary: !canUseSudo()
        ? 'No supported Linux package manager was detected, and this terminal cannot elevate privileges. Re-run this installer from a sudo-capable shell or install Docker Engine and Docker Compose manually.'
        : 'No supported Linux package manager was detected. Install Docker Engine and Docker Compose manually.',
    };
  }

  if (packageManager === 'apt') {
    const commands = elevateLinuxCommands([
      'apt-get update',
      'apt-get install -y docker.io docker-compose-plugin',
      'systemctl enable --now docker',
    ]);

    return {
      platform: 'linux',
      packageManager,
      commands,
      requiresAdmin: commands.length === 0,
      summary:
        commands.length === 0
          ? 'Docker prerequisites require administrator privileges. Re-run this installer from a sudo-capable shell to install Docker Engine and Docker Compose automatically.'
          : 'Installing Docker Engine and Docker Compose with apt-get.',
    };
  }

  if (packageManager === 'dnf') {
    const commands = elevateLinuxCommands([
      'dnf install -y docker docker-compose-plugin',
      'systemctl enable --now docker',
    ]);

    return {
      platform: 'linux',
      packageManager,
      commands,
      requiresAdmin: commands.length === 0,
      summary:
        commands.length === 0
          ? 'Docker prerequisites require administrator privileges. Re-run this installer from a sudo-capable shell to install Docker Engine and Docker Compose automatically.'
          : 'Installing Docker Engine and Docker Compose with dnf.',
    };
  }

  const commands = elevateLinuxCommands([
    'pacman -Sy --noconfirm docker docker-compose',
    'systemctl enable --now docker',
  ]);

  return {
    platform: 'linux',
    packageManager: 'pacman',
    commands,
    requiresAdmin: commands.length === 0,
    summary:
      commands.length === 0
        ? 'Docker prerequisites require administrator privileges. Re-run this installer from a sudo-capable shell to install Docker Engine and Docker Compose automatically.'
        : 'Installing Docker Engine and Docker Compose with pacman.',
  };
}

export function buildDockerDaemonStartPlan(platform = os.platform()): DockerDaemonStartPlan {
  const normalizedPlatform = normalizePlatform(platform);

  if (normalizedPlatform === 'unsupported') {
    return {
      platform: 'unsupported',
      commands: [],
      summary: 'Automatic Docker daemon startup is supported only on Linux and macOS.',
    };
  }

  if (normalizedPlatform === 'macos') {
    return {
      platform: 'macos',
      commands: ['open -a Docker'],
      summary: 'Starting Docker Desktop on macOS.',
    };
  }

  if (hasCommand('systemctl')) {
    const commands = elevateLinuxCommands(['systemctl start docker']);

    return {
      platform: 'linux',
      commands,
      requiresAdmin: commands.length === 0,
      summary:
        commands.length === 0
          ? 'Starting the Docker daemon requires administrator privileges. Re-run this installer from a sudo-capable shell or start Docker manually.'
          : 'Starting the Docker daemon with systemctl.',
    };
  }

  if (hasCommand('service')) {
    const commands = elevateLinuxCommands(['service docker start']);

    return {
      platform: 'linux',
      commands,
      requiresAdmin: commands.length === 0,
      summary:
        commands.length === 0
          ? 'Starting the Docker daemon requires administrator privileges. Re-run this installer from a sudo-capable shell or start Docker manually.'
          : 'Starting the Docker daemon with the service manager.',
    };
  }

  return {
    platform: 'linux',
    commands: [],
    summary: 'No supported service manager was detected. Start Docker manually and try again.',
  };
}

export async function installMissingDependencies(platform = os.platform()): Promise<DependencyInstallResult> {
  const plan = buildDependencyInstallPlan(platform);

  if (plan.commands.length === 0) {
    return {
      attempted: false,
      succeeded: false,
      commands: [],
      requiresAdmin: plan.requiresAdmin,
      summary: plan.summary,
    };
  }

  try {
    for (const command of plan.commands) {
      execSync(command, {
        stdio: 'inherit',
        shell: '/bin/bash',
      });
    }

    return {
      attempted: true,
      succeeded: true,
      commands: plan.commands,
      summary: plan.summary,
      requiresAdmin: plan.requiresAdmin,
    };
  } catch (error) {
    return {
      attempted: true,
      succeeded: false,
      commands: plan.commands,
      requiresAdmin: plan.requiresAdmin,
      summary: plan.requiresAdmin
        ? 'Automatic installation of Docker prerequisites requires administrator privileges. Re-run this installer from a sudo-capable shell or install Docker manually.'
        : 'Automatic installation of Docker prerequisites failed. Please review the remediation steps above.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function startDockerDaemon(platform = os.platform()): Promise<DependencyInstallResult> {
  const plan = buildDockerDaemonStartPlan(platform);

  if (plan.commands.length === 0) {
    return {
      attempted: false,
      succeeded: false,
      commands: [],
      requiresAdmin: plan.requiresAdmin,
      summary: plan.summary,
    };
  }

  try {
    for (const command of plan.commands) {
      execSync(command, {
        stdio: 'inherit',
        shell: '/bin/bash',
      });
    }

    return {
      attempted: true,
      succeeded: true,
      commands: plan.commands,
      summary: plan.summary,
      requiresAdmin: plan.requiresAdmin,
    };
  } catch (error) {
    return {
      attempted: true,
      succeeded: false,
      commands: plan.commands,
      requiresAdmin: plan.requiresAdmin,
      summary: plan.requiresAdmin
        ? 'Automatic Docker daemon startup requires administrator privileges. Re-run this installer from a sudo-capable shell or start Docker manually.'
        : 'Automatic Docker daemon startup failed. Please review the remediation steps above.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
