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
}

// Allow injection for testing
let getFreeMem = () => os.freemem();

export function setFreeMemProvider(provider: () => number): void {
  getFreeMem = provider;
}

export function resetFreeMemProvider(): void {
  getFreeMem = () => os.freemem();
}

/**
 * Check if Docker Engine is installed and the daemon is running.
 * Runs `docker ps` to verify both installation and daemon status.
 */
export async function checkDockerEngine(): Promise<PrereqCheckResult> {
  try {
    execSync('docker ps', { stdio: 'pipe' });
    return {
      passed: true,
      message: 'Docker Engine is installed and running',
    };
  } catch (err) {
    return {
      passed: false,
      message: 'Docker Engine is not installed or daemon is not running',
      remediation:
        'Install Docker Desktop or Docker Engine from https://docs.docker.com/get-docker/ and ensure the daemon is running.',
    };
  }
}

/**
 * Check if Docker Compose v2.0 or later is available.
 * Runs `docker compose version` and parses the version.
 */
export async function checkDockerCompose(): Promise<PrereqCheckResult> {
  try {
    const output = execSync('docker compose version', { encoding: 'utf-8' });
    // Output format: "Docker Compose version v2.x.x"
    const versionMatch = output.match(/v(\d+)\.(\d+)\.(\d+)/);
    if (!versionMatch) {
      return {
        passed: false,
        message: 'Docker Compose version could not be determined',
        remediation: 'Ensure Docker Compose v2.0 or later is installed.',
      };
    }

    const [, major] = versionMatch;
    const majorVersion = parseInt(major, 10);

    if (majorVersion < 2) {
      return {
        passed: false,
        message: `Docker Compose v${majorVersion} is installed, but v2.0 or later is required`,
        remediation: 'Upgrade Docker Compose to v2.0 or later from https://docs.docker.com/compose/install/',
      };
    }

    return {
      passed: true,
      message: `Docker Compose v${majorVersion} is installed`,
    };
  } catch (err) {
    return {
      passed: false,
      message: 'Docker Compose is not installed or not accessible',
      remediation: 'Install Docker Compose v2.0 or later from https://docs.docker.com/compose/install/',
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
    const output = execSync(`df -B1 "${homeDir}"`, { encoding: 'utf-8' });
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
