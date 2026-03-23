/**
 * Local system scanner for cartography.
 *
 * Discovers and maps the local system infrastructure:
 *   - OS & hardware info
 *   - Network interfaces & listening ports
 *   - Docker containers (if available)
 *   - Installed package managers & runtimes
 *   - Detected cloud credential files
 *
 * Phase 3.3: Cartography Scan Service
 */

import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScanAsset {
  asset_type: string;
  provider: string;
  identifier: string;
  metadata_json: Record<string, unknown>;
}

export interface LocalScanResult {
  scan_type: 'local';
  status: 'completed' | 'failed';
  summary_json: {
    hostname: string;
    platform: string;
    arch: string;
    cpus: number;
    total_memory_mb: number;
    uptime_hours: number;
    asset_count: number;
  };
  assets: ScanAsset[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeExec(command: string): string {
  try {
    return execSync(command, { encoding: 'utf8', timeout: 10_000 }).trim();
  } catch {
    return '';
  }
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Scanners
// ---------------------------------------------------------------------------

function scanOSInfo(): ScanAsset {
  return {
    asset_type: 'os',
    provider: 'local',
    identifier: `${os.hostname()}-os`,
    metadata_json: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      type: os.type(),
      cpus: os.cpus().length,
      total_memory_mb: Math.round(os.totalmem() / 1024 / 1024),
      free_memory_mb: Math.round(os.freemem() / 1024 / 1024),
      uptime_hours: Math.round(os.uptime() / 3600),
    },
  };
}

function scanNetworkInterfaces(): ScanAsset[] {
  const interfaces = os.networkInterfaces();
  const assets: ScanAsset[] = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.internal) continue;
      assets.push({
        asset_type: 'network_interface',
        provider: 'local',
        identifier: `${os.hostname()}-${name}-${addr.address}`,
        metadata_json: {
          interface: name,
          address: addr.address,
          family: addr.family,
          netmask: addr.netmask,
          mac: addr.mac,
        },
      });
    }
  }

  return assets;
}

function scanDockerContainers(): ScanAsset[] {
  const output = safeExec('docker ps --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"');
  if (!output) return [];

  return output.split('\n').filter(Boolean).map((line) => {
    const [id, name, image, status, ports] = line.split('|');
    return {
      asset_type: 'container',
      provider: 'docker',
      identifier: id ?? 'unknown',
      metadata_json: { name, image, status, ports },
    };
  });
}

function scanCloudCredentials(): ScanAsset[] {
  const home = os.homedir();
  const assets: ScanAsset[] = [];
  const credentialPaths: Array<{ name: string; path: string; provider: string }> = [
    { name: 'AWS credentials', path: path.join(home, '.aws', 'credentials'), provider: 'aws' },
    { name: 'AWS config', path: path.join(home, '.aws', 'config'), provider: 'aws' },
    { name: 'GCP application default credentials', path: path.join(home, '.config', 'gcloud', 'application_default_credentials.json'), provider: 'gcp' },
    { name: 'Kubernetes config', path: path.join(home, '.kube', 'config'), provider: 'kubernetes' },
  ];

  for (const cred of credentialPaths) {
    if (fileExists(cred.path)) {
      assets.push({
        asset_type: 'credential_file',
        provider: cred.provider,
        identifier: cred.name,
        metadata_json: { path: cred.path, exists: true },
      });
    }
  }

  return assets;
}

function scanRuntimes(): ScanAsset[] {
  const assets: ScanAsset[] = [];

  const nodeVersion = safeExec('node --version');
  if (nodeVersion) {
    assets.push({
      asset_type: 'runtime',
      provider: 'local',
      identifier: 'node',
      metadata_json: { version: nodeVersion },
    });
  }

  const pythonVersion = safeExec('python3 --version') || safeExec('python --version');
  if (pythonVersion) {
    assets.push({
      asset_type: 'runtime',
      provider: 'local',
      identifier: 'python',
      metadata_json: { version: pythonVersion },
    });
  }

  const dockerVersion = safeExec('docker --version');
  if (dockerVersion) {
    assets.push({
      asset_type: 'runtime',
      provider: 'local',
      identifier: 'docker',
      metadata_json: { version: dockerVersion },
    });
  }

  return assets;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a full local system scan and return discovered assets.
 */
export async function scanLocal(): Promise<LocalScanResult> {
  const assets: ScanAsset[] = [];

  // OS info
  assets.push(scanOSInfo());

  // Network interfaces
  assets.push(...scanNetworkInterfaces());

  // Docker containers
  assets.push(...scanDockerContainers());

  // Cloud credentials
  assets.push(...scanCloudCredentials());

  // Runtimes
  assets.push(...scanRuntimes());

  return {
    scan_type: 'local',
    status: 'completed',
    summary_json: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      total_memory_mb: Math.round(os.totalmem() / 1024 / 1024),
      uptime_hours: Math.round(os.uptime() / 3600),
      asset_count: assets.length,
    },
    assets,
  };
}
