import { afterEach, describe, expect, it, vi } from 'vitest';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  buildHealthTimeoutMessage,
  collectDockerComposeDiagnostics,
  persistDockerComposeDiagnostics,
} from './install-diagnostics.js';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

const spawnSyncMock = vi.mocked(spawnSync);

function makeSpawnResult(stdout: string, stderr = '', status = 0): SpawnSyncReturns<string> {
  return {
    pid: 1234,
    output: [null, stdout, stderr],
    stdout,
    stderr,
    status,
    signal: null,
    error: undefined,
  };
}

describe('install diagnostics', () => {
  afterEach(() => {
    spawnSyncMock.mockReset();
  });

  it('collects Docker Compose ps and logs output into a single report', () => {
    spawnSyncMock.mockImplementation((command: string, args?: readonly string[]) => {
      if (command !== 'docker') {
        throw new Error(`Unexpected command: ${command}`);
      }

      const composeArgs = args ?? [];

      if (composeArgs[1] === 'ps') {
        return makeSpawnResult('NAME STATUS\napi Up 2 minutes\nollama Up 2 minutes');
      }

      if (composeArgs[1] === 'logs') {
        return makeSpawnResult('api | booting\nollama | downloading model');
      }

      throw new Error(`Unexpected docker compose args: ${composeArgs.join(' ')}`);
    });

    const report = collectDockerComposeDiagnostics('/tmp/cig-install');

    expect(report).toContain('CIG install diagnostics');
    expect(report).toContain('=== docker compose ps ===');
    expect(report).toContain('api Up 2 minutes');
    expect(report).toContain('=== docker compose logs --no-color --tail 100 ===');
    expect(report).toContain('ollama | downloading model');
    expect(spawnSyncMock).toHaveBeenCalledTimes(2);
  });

  it('persists the diagnostics report to install-failure.log', () => {
    const installDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cig-install-diagnostics-'));
    const diagnosticsPath = persistDockerComposeDiagnostics(installDir, 'sample diagnostics');

    expect(diagnosticsPath).toBe(path.join(installDir, 'install-failure.log'));
    expect(fs.readFileSync(diagnosticsPath, 'utf8')).toBe('sample diagnostics\n');
  });

  it('builds a timeout message that points to the saved diagnostics file', () => {
    const message = buildHealthTimeoutMessage(
      '/tmp/cig-install',
      300_000,
      '/tmp/cig-install/install-failure.log'
    );

    expect(message).toContain('5 minutes');
    expect(message).toContain('/tmp/cig-install/install-failure.log');
    expect(message).toContain('rolled back');
  });

  it('falls back to the rolled-back hint when diagnostics are unavailable', () => {
    const message = buildHealthTimeoutMessage('/tmp/cig-install', 120_000, null);

    expect(message).toContain('2 minutes');
    expect(message).toContain('rolled back');
    expect(message).not.toContain('install-failure.log');
  });
});
