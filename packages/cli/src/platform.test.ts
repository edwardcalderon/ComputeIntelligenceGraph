import { describe, it, expect } from 'vitest';
import { normalizePath, getPlatform, getConfigDir, isWSL } from './platform';

describe('normalizePath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizePath('C:\\Users\\foo\\bar')).toBe('C:/Users/foo/bar');
  });

  it('handles UNC paths on Windows', () => {
    expect(normalizePath('\\\\server\\share\\folder')).toBe('//server/share/folder');
  });

  it('is idempotent (calling twice gives same result)', () => {
    const p = 'some/path/to/file';
    expect(normalizePath(normalizePath(p))).toBe(normalizePath(p));
  });

  it('leaves forward-slash paths unchanged', () => {
    expect(normalizePath('/usr/local/bin')).toBe('/usr/local/bin');
  });
});

describe('getPlatform', () => {
  it("returns one of 'linux', 'macos', 'windows'", () => {
    const result = getPlatform();
    expect(['linux', 'macos', 'windows']).toContain(result);
  });
});

describe('getConfigDir', () => {
  it('returns a non-empty string', () => {
    const dir = getConfigDir();
    expect(typeof dir).toBe('string');
    expect(dir.length).toBeGreaterThan(0);
  });
});

describe('isWSL', () => {
  it('returns a boolean', () => {
    expect(typeof isWSL()).toBe('boolean');
  });
});
