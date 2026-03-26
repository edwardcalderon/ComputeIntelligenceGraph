import { describe, expect, it, vi } from 'vitest';

vi.mock('./install.js', () => ({
  install: vi.fn().mockResolvedValue(undefined),
}));

import { install } from './install.js';
import { setup } from './setup.js';

describe('setup command', () => {
  it('forwards explicit options to the install engine', async () => {
    await setup({
      mode: 'self-hosted',
      profile: 'core',
      apiUrl: 'http://localhost:8000',
    });

    expect(install).toHaveBeenCalledWith('http://localhost:8000', 'self-hosted', 'core');
  });

  it('returns cleanly when installation is cancelled', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(install).mockRejectedValueOnce(new Error('Installation was cancelled.'));

    await expect(
      setup({
        mode: 'self-hosted',
        profile: 'core',
        apiUrl: 'http://localhost:8000',
      })
    ).resolves.toBeUndefined();

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
