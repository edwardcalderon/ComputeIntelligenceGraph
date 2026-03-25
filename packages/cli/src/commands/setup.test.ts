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
});
