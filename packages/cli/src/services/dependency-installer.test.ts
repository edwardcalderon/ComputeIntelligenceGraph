import { afterEach, describe, expect, it, vi } from 'vitest';
import { execSync } from 'node:child_process';
import type { PrereqCheckResult } from '../prereqs.js';
import {
  buildDependencyInstallPlan,
  buildDependencyInstallPrompt,
  buildDockerDaemonStartPlan,
  buildDockerDaemonStartPrompt,
  installMissingDependencies,
  startDockerDaemon,
  splitPrereqFailures,
} from './dependency-installer.js';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

const execSyncMock = vi.mocked(execSync);

function setCommandAvailability(available: Record<string, boolean>): void {
  execSyncMock.mockImplementation((command: string) => {
    if (command.startsWith('command -v ')) {
      const binary = command.slice('command -v '.length).trim();
      if (available[binary]) {
        return Buffer.from(`/usr/bin/${binary}`);
      }

      throw new Error(`missing ${binary}`);
    }

    return Buffer.from('');
  });
}

describe('dependency-installer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('splits installable docker failures from manual failures', () => {
    const results: PrereqCheckResult[] = [
      {
        passed: false,
        message: 'Docker missing',
        remediation: 'Install Docker',
        installGroup: 'docker',
        remediationKind: 'install',
      },
      {
        passed: false,
        message: 'Docker daemon stopped',
        remediation: 'Start Docker',
        installGroup: 'docker',
        remediationKind: 'start',
      },
      {
        passed: false,
        message: 'Docker daemon access denied',
        remediation: 'Run as admin',
        installGroup: 'docker',
        remediationKind: 'admin',
      },
      { passed: false, message: 'Disk low', remediation: 'Free disk space', remediationKind: 'manual' },
      { passed: true, message: 'Memory OK' },
    ];

    expect(splitPrereqFailures(results)).toEqual({
      installable: [results[0]],
      startable: [results[1]],
      admin: [results[2]],
      manual: [results[3]],
    });
  });

  it('builds a prompt that explains when Docker can be auto-installed', () => {
    const prompt = buildDependencyInstallPrompt({
      installable: [
        {
          passed: false,
          message: 'Docker missing',
          installGroup: 'docker',
          remediationKind: 'install',
        },
      ],
      startable: [],
      admin: [],
      manual: [],
    });

    expect(prompt).toContain('Docker prerequisites are missing');
    expect(prompt).toContain('automatically');
  });

  it('builds a prompt that asks to start the Docker daemon first', () => {
    const prompt = buildDockerDaemonStartPrompt({
      installable: [],
      startable: [
        {
          passed: false,
          message: 'Docker daemon stopped',
          installGroup: 'docker',
          remediationKind: 'start',
        },
      ],
      admin: [],
      manual: [],
    });

    expect(prompt).toContain('Docker is installed but not running');
    expect(prompt).toContain('start the daemon');
  });

  it('builds apt-based install commands on Linux', () => {
    setCommandAvailability({
      'apt-get': true,
      dnf: false,
      pacman: false,
      brew: false,
      sudo: true,
    });

    expect(buildDependencyInstallPlan('linux')).toMatchObject({
      platform: 'linux',
      packageManager: 'apt',
      commands: [
        'sudo apt-get update',
        'sudo apt-get install -y docker.io docker-compose-plugin',
        'sudo systemctl enable --now docker',
      ],
      summary: 'Installing Docker Engine and Docker Compose with apt-get.',
    });
  });

  it('builds Homebrew commands on macOS', () => {
    setCommandAvailability({
      'apt-get': false,
      dnf: false,
      pacman: false,
      brew: true,
      sudo: true,
    });

    expect(buildDependencyInstallPlan('darwin')).toEqual({
      platform: 'macos',
      packageManager: 'brew',
      commands: ['brew install --cask docker', 'open -a Docker'],
      summary: 'Installing Docker Desktop with Homebrew and opening the app once installation completes.',
    });
  });

  it('builds daemon-start commands on Linux when systemctl is available', () => {
    setCommandAvailability({
      'apt-get': false,
      dnf: false,
      pacman: false,
      brew: false,
      systemctl: true,
      service: false,
      sudo: true,
    });

    expect(buildDockerDaemonStartPlan('linux')).toMatchObject({
      platform: 'linux',
      commands: ['sudo systemctl start docker'],
      summary: 'Starting the Docker daemon with systemctl.',
    });
  });

  it('executes the planned install commands when automatic remediation is available', async () => {
    setCommandAvailability({
      'apt-get': true,
      dnf: false,
      pacman: false,
      brew: false,
      sudo: true,
    });

    const result = await installMissingDependencies('linux');

    expect(result.succeeded).toBe(true);
    expect(result.attempted).toBe(true);
    expect(result.commands).toEqual([
      'sudo apt-get update',
      'sudo apt-get install -y docker.io docker-compose-plugin',
      'sudo systemctl enable --now docker',
    ]);
    expect(execSyncMock).toHaveBeenCalledWith('sudo apt-get update', expect.any(Object));
    expect(execSyncMock).toHaveBeenCalledWith('sudo apt-get install -y docker.io docker-compose-plugin', expect.any(Object));
    expect(execSyncMock).toHaveBeenCalledWith('sudo systemctl enable --now docker', expect.any(Object));
  });

  it('executes the planned daemon-start command when remediation is available', async () => {
    setCommandAvailability({
      'apt-get': false,
      dnf: false,
      pacman: false,
      brew: false,
      systemctl: true,
      service: false,
      sudo: true,
    });

    const result = await startDockerDaemon('linux');

    expect(result.succeeded).toBe(true);
    expect(result.attempted).toBe(true);
    expect(result.commands).toEqual(['sudo systemctl start docker']);
    expect(execSyncMock).toHaveBeenCalledWith('sudo systemctl start docker', expect.any(Object));
  });

  it('marks Linux remediation as admin-required when sudo is unavailable', async () => {
    setCommandAvailability({
      'apt-get': true,
      dnf: false,
      pacman: false,
      brew: false,
      systemctl: true,
      service: false,
      sudo: false,
    });

    const installPlan = buildDependencyInstallPlan('linux');
    const startPlan = buildDockerDaemonStartPlan('linux');

    expect(installPlan.commands).toEqual([]);
    expect(installPlan.requiresAdmin).toBe(true);
    expect(installPlan.summary).toContain('administrator privileges');

    expect(startPlan.commands).toEqual([]);
    expect(startPlan.requiresAdmin).toBe(true);
    expect(startPlan.summary).toContain('administrator privileges');
  });
});
