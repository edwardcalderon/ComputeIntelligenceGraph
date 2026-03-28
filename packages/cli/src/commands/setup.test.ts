import { describe, expect, it, vi } from 'vitest';

vi.mock('./install.js', () => ({
  install: vi.fn().mockResolvedValue(undefined),
  resolveSelfHostedInferenceChoice: vi.fn(async (choice?: string) => choice ?? 'ollama'),
}));

import { install } from './install.js';
import { setup } from './setup.js';

describe('setup command', () => {
  it('forwards explicit options to the install engine', async () => {
    await setup({
      mode: 'self-hosted',
      profile: 'discovery',
      apiUrl: 'http://localhost:3003',
    });

    expect(install).toHaveBeenCalledWith(
      'http://localhost:3003',
      'self-hosted',
      'discovery',
      false,
      'ollama'
    );
  });

  it('forwards demo mode when explicitly requested', async () => {
    await setup({
      mode: 'self-hosted',
      profile: 'discovery',
      apiUrl: 'http://localhost:3003',
      demo: true,
    });

    expect(install).toHaveBeenCalledWith(
      'http://localhost:3003',
      'self-hosted',
      'discovery',
      true,
      'ollama'
    );
  });

  it('forwards explicit self-hosted inference choices', async () => {
    await setup({
      mode: 'self-hosted',
      profile: 'discovery',
      apiUrl: 'http://localhost:3003',
      inference: 'gemma',
    });

    expect(install).toHaveBeenCalledWith(
      'http://localhost:3003',
      'self-hosted',
      'discovery',
      false,
      'gemma'
    );
  });

  it('returns cleanly when installation is cancelled', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(install).mockRejectedValueOnce(new Error('Installation was cancelled.'));

    await expect(
      setup({
        mode: 'self-hosted',
        profile: 'discovery',
        apiUrl: 'http://localhost:3003',
      })
    ).resolves.toBeUndefined();

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
