import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Normalizes path separators to forward slashes on all platforms.
 * Handles UNC paths (\\server\share) by preserving the leading double slash.
 */
export function normalizePath(p: string): string {
  // Handle UNC paths: \\server\share -> //server/share
  if (p.startsWith('\\\\')) {
    return '//' + p.slice(2).split('\\').join('/');
  }
  return p.split('\\').join('/');
}

/**
 * Detects the current platform.
 */
export function getPlatform(): 'linux' | 'macos' | 'windows' {
  const platform = os.platform();
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  return 'linux';
}

/**
 * Returns the CIG config directory for the current platform.
 * - Linux/macOS: ~/.cig
 * - Windows: %APPDATA%\cig
 */
export function getConfigDir(): string {
  if (getPlatform() === 'windows') {
    const appData = process.env['APPDATA'] || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'cig');
  }
  return path.join(os.homedir(), '.cig');
}

/**
 * Detects if running inside WSL2 (Windows Subsystem for Linux).
 */
export function isWSL(): boolean {
  if (os.platform() !== 'linux') return false;
  try {
    const release = os.release().toLowerCase();
    if (release.includes('microsoft') || release.includes('wsl')) return true;
    // Check /proc/version as a fallback
    const procVersion = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
    return procVersion.includes('microsoft') || procVersion.includes('wsl');
  } catch {
    return false;
  }
}
