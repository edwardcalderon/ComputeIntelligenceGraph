import { execSync } from 'node:child_process';
import * as os from 'node:os';
import type { PrereqCheckResult } from '../prereqs.js';

export interface PrereqFailureGroups {
  installable: PrereqCheckResult[];
  startable: PrereqCheckResult[];
  manual: PrereqCheckResult[];
}

export interface DependencyInstallPlan {
  platform: 'linux' | 'macos' | 'unsupported';
  packageManager?: 'apt' | 'dnf' | 'pacman' | 'brew';
  commands: string[];
  summary: string;
}

export interface DockerDaemonStartPlan {
  platform: 'linux' | 'macos' | 'unsupported';
  commands: string[];
  summary: string;
}

export interface DependencyInstallResult {
  attempted: boolean;
  succeeded: boolean;
  commands: string[];
  summary: string;
  error?: string;
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
  const manual = results.filter((result) => !result.passed && result.remediationKind !== 'install' && result.remediationKind !== 'start');

  return { installable, startable, manual };
}

export function buildDependencyInstallPrompt(groups: PrereqFailureGroups): string {
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
      summary:
        'No supported Linux package manager was detected. Install Docker Engine and Docker Compose manually.',
    };
  }

  if (packageManager === 'apt') {
    return {
      platform: 'linux',
      packageManager,
      commands: ['sudo apt-get update', 'sudo apt-get install -y docker.io docker-compose-plugin', 'sudo systemctl enable --now docker'],
      summary: 'Installing Docker Engine and Docker Compose with apt-get.',
    };
  }

  if (packageManager === 'dnf') {
    return {
      platform: 'linux',
      packageManager,
      commands: ['sudo dnf install -y docker docker-compose-plugin', 'sudo systemctl enable --now docker'],
      summary: 'Installing Docker Engine and Docker Compose with dnf.',
    };
  }

  return {
    platform: 'linux',
    packageManager: 'pacman',
    commands: ['sudo pacman -Sy --noconfirm docker docker-compose', 'sudo systemctl enable --now docker'],
    summary: 'Installing Docker Engine and Docker Compose with pacman.',
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
    return {
      platform: 'linux',
      commands: ['sudo systemctl start docker'],
      summary: 'Starting the Docker daemon with systemctl.',
    };
  }

  if (hasCommand('service')) {
    return {
      platform: 'linux',
      commands: ['sudo service docker start'],
      summary: 'Starting the Docker daemon with the service manager.',
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
    };
  } catch (error) {
    return {
      attempted: true,
      succeeded: false,
      commands: plan.commands,
      summary: 'Automatic installation of Docker prerequisites failed. Please review the remediation steps above.',
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
    };
  } catch (error) {
    return {
      attempted: true,
      succeeded: false,
      commands: plan.commands,
      summary: 'Automatic Docker daemon startup failed. Please review the remediation steps above.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
