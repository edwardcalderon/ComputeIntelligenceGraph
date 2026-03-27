import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  isCancel: vi.fn(() => false),
}));

import { confirm } from '@clack/prompts';
import { resolveDemoDataPreference } from '../demo-data.js';

function setInteractiveTerminal(interactive: boolean): void {
  Object.defineProperty(process.stdin, 'isTTY', {
    configurable: true,
    value: interactive,
  });
  Object.defineProperty(process.stdout, 'isTTY', {
    configurable: true,
    value: interactive,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (process.stdin as NodeJS.ReadStream & { isTTY?: boolean }).isTTY;
  delete (process.stdout as NodeJS.WriteStream & { isTTY?: boolean }).isTTY;
});

describe('resolveDemoDataPreference', () => {
  it('returns an explicit value without prompting', async () => {
    const result = await resolveDemoDataPreference({ explicitDemo: true });

    expect(result).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('falls back to the default when the terminal is not interactive', async () => {
    setInteractiveTerminal(false);

    const result = await resolveDemoDataPreference({ defaultValue: true });

    expect(result).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('prompts when interactive and no explicit value is provided', async () => {
    setInteractiveTerminal(true);
    vi.mocked(confirm).mockResolvedValueOnce(true as never);

    const result = await resolveDemoDataPreference({ defaultValue: false });

    expect(confirm).toHaveBeenCalledWith({
      message: 'Include demo data in this installation?',
      initialValue: false,
    });
    expect(result).toBe(true);
  });
});
