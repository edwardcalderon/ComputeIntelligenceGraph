/**
 * Scan Command
 *
 * Runs cartography scanners to discover and map infrastructure.
 *
 * Usage:
 *   cig scan [--type local|cloud|all] [--provider aws|gcp|k8s] [--upload] [--json]
 *
 * Phase 3.5: Cartography Scan Service — CLI Command
 */

import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { CredentialManager } from '../credentials.js';
import { ApiClient } from '../services/api-client.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScanAsset {
  asset_type: string;
  provider: string;
  identifier: string;
  metadata_json: Record<string, unknown>;
}

interface ScanResult {
  scan_type: string;
  provider?: string;
  status: 'completed' | 'failed';
  summary_json: Record<string, unknown>;
  assets: ScanAsset[];
}

export interface ScanOptions {
  type: 'local' | 'cloud' | 'all';
  provider?: 'aws' | 'gcp' | 'k8s';
  upload: boolean;
  json: boolean;
  apiUrl: string;
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
// Local scanner (inline to avoid cross-package import)
// ---------------------------------------------------------------------------

function scanLocal(): ScanResult {
  const assets: ScanAsset[] = [];

  // OS info
  assets.push({
    asset_type: 'os',
    provider: 'local',
    identifier: `${os.hostname()}-os`,
    metadata_json: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      cpus: os.cpus().length,
      total_memory_mb: Math.round(os.totalmem() / 1024 / 1024),
      free_memory_mb: Math.round(os.freemem() / 1024 / 1024),
      uptime_hours: Math.round(os.uptime() / 3600),
    },
  });

  // Network interfaces
  const interfaces = os.networkInterfaces();
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

  // Docker containers
  const dockerOutput = safeExec('docker ps --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"');
  if (dockerOutput) {
    for (const line of dockerOutput.split('\n').filter(Boolean)) {
      const [id, name, image, status, ports] = line.split('|');
      assets.push({
        asset_type: 'container',
        provider: 'docker',
        identifier: id ?? 'unknown',
        metadata_json: { name, image, status, ports },
      });
    }
  }

  // Cloud credential files
  const home = os.homedir();
  const credPaths = [
    { name: 'AWS credentials', path: path.join(home, '.aws', 'credentials'), provider: 'aws' },
    { name: 'GCP ADC', path: path.join(home, '.config', 'gcloud', 'application_default_credentials.json'), provider: 'gcp' },
    { name: 'Kubernetes config', path: path.join(home, '.kube', 'config'), provider: 'kubernetes' },
  ];
  for (const cred of credPaths) {
    if (fileExists(cred.path)) {
      assets.push({
        asset_type: 'credential_file',
        provider: cred.provider,
        identifier: cred.name,
        metadata_json: { path: cred.path, exists: true },
      });
    }
  }

  // Runtime versions
  const nodeVersion = safeExec('node --version');
  if (nodeVersion) {
    assets.push({ asset_type: 'runtime', provider: 'local', identifier: 'node', metadata_json: { version: nodeVersion } });
  }

  const pythonVersion = safeExec('python3 --version') || safeExec('python --version');
  if (pythonVersion) {
    assets.push({ asset_type: 'runtime', provider: 'local', identifier: 'python', metadata_json: { version: pythonVersion } });
  }

  const dockerVersion = safeExec('docker --version');
  if (dockerVersion) {
    assets.push({ asset_type: 'runtime', provider: 'local', identifier: 'docker', metadata_json: { version: dockerVersion } });
  }

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

// ---------------------------------------------------------------------------
// Cloud scanner stubs
// ---------------------------------------------------------------------------

function scanCloud(provider?: string): ScanResult {
  const assets: ScanAsset[] = [];
  const targetProvider = provider ?? 'aws';

  if (targetProvider === 'aws') {
    const hasCredentials = !!(process.env['AWS_ACCESS_KEY_ID'] || process.env['AWS_PROFILE'] || process.env['AWS_ROLE_ARN']);
    if (!hasCredentials) {
      return {
        scan_type: 'cloud',
        provider: 'aws',
        status: 'failed',
        summary_json: { error: 'No AWS credentials configured. Run `cig connect aws --role-arn <arn>` first.' },
        assets: [],
      };
    }
    assets.push({
      asset_type: 'cloud_account',
      provider: 'aws',
      identifier: process.env['AWS_ACCOUNT_ID'] ?? 'unknown',
      metadata_json: { region: process.env['AWS_REGION'] ?? 'us-east-2', scan_note: 'Stub scan' },
    });
  } else if (targetProvider === 'gcp') {
    const hasCredentials = !!(process.env['GOOGLE_APPLICATION_CREDENTIALS'] || process.env['GCP_PROJECT']);
    if (!hasCredentials) {
      return {
        scan_type: 'cloud',
        provider: 'gcp',
        status: 'failed',
        summary_json: { error: 'No GCP credentials configured. Run `cig connect gcp --service-account <path>` first.' },
        assets: [],
      };
    }
    assets.push({
      asset_type: 'cloud_project',
      provider: 'gcp',
      identifier: process.env['GCP_PROJECT'] ?? 'unknown',
      metadata_json: { project: process.env['GCP_PROJECT'], scan_note: 'Stub scan' },
    });
  }

  return {
    scan_type: 'cloud',
    provider: targetProvider,
    status: 'completed',
    summary_json: { provider: targetProvider, asset_count: assets.length },
    assets,
  };
}

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------

export async function scan(options: ScanOptions): Promise<void> {
  const results: ScanResult[] = [];

  console.log(`Starting ${options.type} scan...`);

  if (options.type === 'local' || options.type === 'all') {
    const localResult = scanLocal();
    results.push(localResult);
    if (!options.json) {
      console.log(`\n✓ Local scan complete: ${localResult.assets.length} assets discovered`);
    }
  }

  if (options.type === 'cloud' || options.type === 'all') {
    const cloudResult = scanCloud(options.provider);
    results.push(cloudResult);
    if (!options.json) {
      if (cloudResult.status === 'failed') {
        console.log(`\n✗ Cloud scan failed: ${cloudResult.summary_json['error'] ?? 'Unknown error'}`);
      } else {
        console.log(`\n✓ Cloud scan complete: ${cloudResult.assets.length} assets discovered`);
      }
    }
  }

  // Merge all assets for output
  const allAssets = results.flatMap((r) => r.assets);
  const totalCount = allAssets.length;

  if (options.json) {
    console.log(JSON.stringify({ results, total_assets: totalCount }, null, 2));
  } else {
    console.log(`\nTotal assets discovered: ${totalCount}`);
    for (const asset of allAssets) {
      console.log(`  [${asset.provider}] ${asset.asset_type}: ${asset.identifier}`);
    }
  }

  // Upload results to API if requested
  if (options.upload) {
    const credentialManager = new CredentialManager();
    const tokens = credentialManager.loadTokens();

    if (!tokens?.accessToken) {
      console.error('\n✗ Not authenticated. Run `cig login` first to upload scan results.');
      return;
    }

    const apiClient = new ApiClient({ baseUrl: options.apiUrl, accessToken: tokens.accessToken });

    for (const result of results) {
      try {
        const response = await apiClient.post<{ scan_id: string; asset_count: number }>('/api/v1/scans', {
          scan_type: result.scan_type,
          provider: result.provider,
          status: result.status,
          summary_json: result.summary_json,
          assets: result.assets,
        });
        console.log(`\n✓ Uploaded ${result.scan_type} scan results (scan_id: ${response.scan_id}, ${response.asset_count} assets)`);
      } catch (err) {
        console.error(`\n✗ Failed to upload ${result.scan_type} scan results:`, err instanceof Error ? err.message : String(err));
      }
    }
  }
}
