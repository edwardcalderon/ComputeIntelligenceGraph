/**
 * Prerequisite Checks for CIG Installation
 *
 * Validates system requirements:
 * - Docker Engine installed and daemon running
 * - Docker Compose v2.0 or later
 * - At least 4 GB free memory
 * - At least 10 GB free disk space
 * - Required ports available (3000, 7474, 7687, 8000, 8080)
 *
 * Requirement 7: CLI Install Flow (Prerequisite Checks)
 */

import { execSync } from 'child_process';
import * as os from 'os';
import * as net from 'net';
import { promisify } from 'util';

const exec = promisify(require('child_process').exec);

export interface PrereqCheckResult {
  passed: boolean;
  message: string;
  remediation?: string;
  installGroup?: 'docker';
  remediationKind?: 'install' | 'start' | 'admin' | 'manual';
}

// Allow injection for testing
let getFreeMem = () => os.freemem();
let runCommand = execSync;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function classifyDockerEngineFailure(errorMessage: string): 'admin' | 'start' | 'unknown' {
  const normalized = errorMessage.toLowerCase();

  if (
    normalized.includes('permission denied') ||
    normalized.includes('got permission denied') ||
    normalized.includes('permission to connect to the docker daemon') ||
    normalized.includes('permission to access the docker daemon')
  ) {
    return 'admin';
  }

  if (
    normalized.includes('cannot connect to the docker daemon') ||
    normalized.includes('is the docker daemon running') ||
    normalized.includes('the docker daemon is not running') ||
    normalized.includes('no such file or directory') ||
    normalized.includes('context deadline exceeded')
  ) {
    return 'start';
  }

  return 'unknown';
}

export function setFreeMemProvider(provider: () => number): void {
  getFreeMem = provider;
}

export function resetFreeMemProvider(): void {
  getFreeMem = () => os.freemem();
}

export function setExecSyncProvider(provider: typeof execSync): void {
  runCommand = provider;
}

export function resetExecSyncProvider(): void {
  runCommand = execSync;
}

/**
 * Check if Docker Engine is installed and the daemon is running.
 * Runs `docker info` to verify both installation and daemon access.
 */
export async function checkDockerEngine(): Promise<PrereqCheckResult> {
  try {
    runCommand('docker --version', { stdio: 'pipe' });
  } catch (err) {
    return {
      passed: false,
      message: 'Docker Engine is not installed',
      remediation:
        'Install Docker Desktop or Docker Engine from https://docs.docker.com/get-docker/ and ensure the daemon is running.',
      installGroup: 'docker',
      remediationKind: 'install',
    };
  }

  try {
    runCommand('docker info', { stdio: 'pipe' });
    return {
      passed: true,
      message: 'Docker Engine is installed and running',
      installGroup: 'docker',
      remediationKind: 'manual',
    };
  } catch (err) {
    const stderr = getErrorMessage(err);
    const kind = classifyDockerEngineFailure(stderr);

    if (kind === 'admin') {
      return {
        passed: false,
        message: `Docker is installed, but this user cannot access the daemon${stderr ? ` (${stderr})` : ''}`,
        remediation:
          'Run the installer from an administrator shell, add this user to the docker group, or retry with sudo-enabled access.',
        installGroup: 'docker',
        remediationKind: 'admin',
      };
    }

    return {
      passed: false,
      message: `Docker is installed, but the daemon is not running${stderr ? ` (${stderr})` : ''}`,
      remediation:
        'Start Docker Desktop or initialize the Docker daemon automatically, then try again.',
      installGroup: 'docker',
      remediationKind: 'start',
    };
  }
}

/**
 * Check if Docker Compose v2.0 or later is available.
 * Runs `docker compose version` and parses the version.
 */
export async function checkDockerCompose(): Promise<PrereqCheckResult> {
  try {
    const output = runCommand('docker compose version', { encoding: 'utf-8' });
    // Output format: "Docker Compose version v2.x.x"
    const versionMatch = output.match(/v(\d+)\.(\d+)\.(\d+)/);
    if (!versionMatch) {
    return {
      passed: false,
      message: 'Docker Compose version could not be determined',
      remediation: 'Ensure Docker Compose v2.0 or later is installed.',
      installGroup: 'docker',
      remediationKind: 'install',
    };
  }

    const [, major] = versionMatch;
    const majorVersion = parseInt(major, 10);

    if (majorVersion < 2) {
    return {
      passed: false,
      message: `Docker Compose v${majorVersion} is installed, but v2.0 or later is required`,
      remediation: 'Upgrade Docker Compose to v2.0 or later from https://docs.docker.com/compose/install/',
      installGroup: 'docker',
      remediationKind: 'install',
    };
  }

    return {
      passed: true,
      message: `Docker Compose v${majorVersion} is installed`,
      installGroup: 'docker',
    };
  } catch (err) {
    return {
      passed: false,
      message: 'Docker Compose is not installed or not accessible',
      remediation: 'Install Docker Compose v2.0 or later from https://docs.docker.com/compose/install/',
      installGroup: 'docker',
      remediationKind: 'install',
    };
  }
}

/**
 * Check if at least 4 GB of free memory is available.
 * Uses getFreeMem() to get the system free memory in bytes.
 */
export async function checkMemory(): Promise<PrereqCheckResult> {
  const freeMemBytes = getFreeMem();
  const freeMemGb = freeMemBytes / (1024 * 1024 * 1024);
  const requiredGb = 4;

  if (freeMemGb >= requiredGb) {
    return {
      passed: true,
      message: `${freeMemGb.toFixed(2)} GB of free memory available`,
    };
  }

  return {
    passed: false,
    message: `Only ${freeMemGb.toFixed(2)} GB of free memory available, but ${requiredGb} GB is required`,
    remediation: 'Close other applications to free up memory, or add more RAM to your system.',
  };
}

/**
 * Check if at least 10 GB of free disk space is available in the home directory.
 * Uses `df` command to check disk space.
 */
export async function checkDiskSpace(): Promise<PrereqCheckResult> {
  try {
    const homeDir = os.homedir();
    const output = runCommand(`df -B1 "${homeDir}"`, { encoding: 'utf-8' });
    const lines = output.trim().split('\n');
    if (lines.length < 2) {
      return {
        passed: false,
        message: 'Could not determine disk space',
        remediation: 'Ensure the home directory is accessible and has sufficient space.',
      };
    }

    // Parse the second line (first is header)
    const parts = lines[1].split(/\s+/);
    const availableBytes = parseInt(parts[3], 10);
    const availableGb = availableBytes / (1024 * 1024 * 1024);
    const requiredGb = 10;

    if (availableGb >= requiredGb) {
      return {
        passed: true,
        message: `${availableGb.toFixed(2)} GB of free disk space available`,
      };
    }

    return {
      passed: false,
      message: `Only ${availableGb.toFixed(2)} GB of free disk space available, but ${requiredGb} GB is required`,
      remediation: 'Free up disk space by removing unnecessary files, or expand your storage.',
    };
  } catch (err) {
    return {
      passed: false,
      message: 'Could not determine disk space',
      remediation: 'Ensure the home directory is accessible and has sufficient space.',
    };
  }
}

/**
 * Check if a specific port is available (not in use).
 * Attempts to bind to the port; if successful, the port is available.
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Check if required ports (3000, 7474, 7687, 8000, 8080) are available.
 */
export async function checkPorts(): Promise<PrereqCheckResult> {
  const requiredPorts = [3000, 7474, 7687, 8000, 8080];
  const unavailablePorts: number[] = [];

  for (const port of requiredPorts) {
    const available = await isPortAvailable(port);
    if (!available) {
      unavailablePorts.push(port);
    }
  }

  if (unavailablePorts.length === 0) {
    return {
      passed: true,
      message: `All required ports are available: ${requiredPorts.join(', ')}`,
    };
  }

  return {
    passed: false,
    message: `The following ports are in use: ${unavailablePorts.join(', ')}`,
    remediation: `Stop the services using these ports or configure CIG to use different ports. Use 'lsof -i :PORT' to identify the process using each port.`,
    remediationKind: 'manual',
  };
}

/**
 * Run all prerequisite checks and return results.
 */
export async function runAllChecks(): Promise<PrereqCheckResult[]> {
  const results = await Promise.all([
    checkDockerEngine(),
    checkDockerCompose(),
    checkMemory(),
    checkDiskSpace(),
    checkPorts(),
  ]);
  return results;
}
