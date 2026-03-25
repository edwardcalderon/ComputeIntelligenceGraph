import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCli, type CliCommandRegistry } from './cli.js';

function createRegistry(spies: Record<string, ReturnType<typeof vi.fn>>): CliCommandRegistry {
  return {
    connect: {
      description: 'Configure discovery and API connection profiles',
      command: {
        run: vi.fn().mockResolvedValue(undefined),
      },
    },
    'connect aws': {
      description: 'Save the AWS AssumeRole ARN for discovery',
      command: {
        run: spies.connectAws,
      },
    },
    status: {
      description: 'Show installation and connection status',
      command: {
        run: spies.status,
      },
    },
  };
}

describe('CLI dispatcher', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('routes connect aws to the nested oclif command with remaining args', async () => {
    const connectAws = vi.fn().mockResolvedValue(undefined);
    const registry = createRegistry({
      connectAws,
      status: vi.fn().mockResolvedValue(undefined),
    });

    await runCli(['connect', 'aws', '--role-arn', 'arn:aws:iam::123456789012:role/CIGRole'], registry);

    expect(connectAws).toHaveBeenCalledWith(['--role-arn', 'arn:aws:iam::123456789012:role/CIGRole']);
  });

  it('prints the root help when no command is provided', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runCli([], createRegistry({ connectAws: vi.fn(), status: vi.fn() }));

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CIG CLI v'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('login'));
    consoleSpy.mockRestore();
  });

  it('sets a non-zero exit code for unknown commands', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await runCli(['unknown-command'], createRegistry({ connectAws: vi.fn(), status: vi.fn() }));

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
    expect(process.exitCode).toBe(1);
    consoleSpy.mockRestore();
  });
});
