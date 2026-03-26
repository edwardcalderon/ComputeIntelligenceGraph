import * as fs from 'node:fs';
import * as path from 'node:path';
import { CredentialManager } from '../credentials.js';
import { resolveCliPaths } from '../storage/paths.js';
import { ScanResult, scanLocal } from '../commands/scan.js';
import { ApiClient } from './api-client.js';

export interface InitialGraphArtifact {
  schemaVersion: 1;
  mode: 'managed' | 'self-hosted';
  profile: 'core' | 'discovery' | 'full';
  targetApiUrl: string;
  createdAt: string;
  scan: ScanResult;
  upload?: {
    scanId: string;
    assetCount: number;
    uploadedAt: string;
  };
}

export interface InitialGraphSeedOptions {
  installDir: string;
  apiUrl: string;
  mode: 'managed' | 'self-hosted';
  profile: 'core' | 'discovery' | 'full';
  credentialManager?: CredentialManager;
}

export interface InitialGraphSyncOptions {
  apiUrl: string;
  installDir?: string;
  credentialManager?: CredentialManager;
}

export interface InitialGraphSeedResult {
  artifactPath: string;
  uploaded: boolean;
  pending: boolean;
  scanId?: string;
  assetCount: number;
}

export interface InitialGraphSyncResult {
  uploaded: number;
  pending: number;
  artifactPaths: string[];
}

const INITIAL_GRAPH_FILE = 'initial-graph.json';

function normalizeApiUrl(apiUrl: string): string {
  const url = new URL(apiUrl);
  if (url.hostname === 'localhost') {
    url.hostname = '127.0.0.1';
  }
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/+$/, '');
}

function getArtifactsDir(installDir: string): string {
  return path.join(installDir, 'scans');
}

function getArtifactPath(installDir: string): string {
  return path.join(getArtifactsDir(installDir), INITIAL_GRAPH_FILE);
}

function ensureArtifactDir(installDir: string): void {
  fs.mkdirSync(getArtifactsDir(installDir), { recursive: true, mode: 0o700 });
}

function writeArtifact(installDir: string, artifact: InitialGraphArtifact): string {
  ensureArtifactDir(installDir);
  const artifactPath = getArtifactPath(installDir);
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), { mode: 0o600 });
  return artifactPath;
}

function readArtifact(artifactPath: string): InitialGraphArtifact | null {
  if (!fs.existsSync(artifactPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as InitialGraphArtifact;
  } catch {
    return null;
  }
}

function listArtifactPaths(installDir: string): string[] {
  const artifactsDir = getArtifactsDir(installDir);
  if (!fs.existsSync(artifactsDir)) {
    return [];
  }

  return fs
    .readdirSync(artifactsDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => path.join(artifactsDir, fileName));
}

async function uploadArtifact(
  artifact: InitialGraphArtifact,
  options: { apiUrl: string; credentialManager: CredentialManager }
): Promise<{ uploaded: boolean; scanId?: string; assetCount: number }> {
  const tokens = options.credentialManager.loadTokens();
  if (!tokens?.accessToken) {
    return { uploaded: false, assetCount: artifact.scan.assets.length };
  }

  const apiClient = new ApiClient({
    baseUrl: normalizeApiUrl(options.apiUrl),
    accessToken: tokens.accessToken,
  });

  const response = await apiClient.post<{ scan_id: string; asset_count: number }>('/api/v1/scans', {
    scan_type: artifact.scan.scan_type,
    provider: artifact.scan.provider,
    status: artifact.scan.status,
    summary_json: artifact.scan.summary_json,
    assets: artifact.scan.assets,
  });

  return {
    uploaded: true,
    scanId: response.scan_id,
    assetCount: response.asset_count,
  };
}

async function storeArtifactWithUploadState(
  installDir: string,
  artifact: InitialGraphArtifact,
  uploadState?: { scanId: string; assetCount: number }
): Promise<string> {
  const storedArtifact: InitialGraphArtifact = uploadState
    ? {
        ...artifact,
        upload: {
          scanId: uploadState.scanId,
          assetCount: uploadState.assetCount,
          uploadedAt: new Date().toISOString(),
        },
      }
    : artifact;

  return writeArtifact(installDir, storedArtifact);
}

export async function seedInitialGraph(options: InitialGraphSeedOptions): Promise<InitialGraphSeedResult> {
  const credentialManager = options.credentialManager ?? new CredentialManager();
  const normalizedApiUrl = normalizeApiUrl(options.apiUrl);
  const artifact: InitialGraphArtifact = {
    schemaVersion: 1,
    mode: options.mode,
    profile: options.profile,
    targetApiUrl: normalizedApiUrl,
    createdAt: new Date().toISOString(),
    scan: scanLocal(),
  };

  let artifactPath = await storeArtifactWithUploadState(options.installDir, artifact);

  try {
    const uploadResult = await uploadArtifact(artifact, {
      apiUrl: normalizedApiUrl,
      credentialManager,
    });

    if (uploadResult.uploaded && uploadResult.scanId) {
      artifactPath = await storeArtifactWithUploadState(options.installDir, artifact, {
        scanId: uploadResult.scanId,
        assetCount: uploadResult.assetCount,
      });
      return {
        artifactPath,
        uploaded: true,
        pending: false,
        scanId: uploadResult.scanId,
        assetCount: uploadResult.assetCount,
      };
    }
  } catch {
    // Keep the pending artifact on disk; upload can be retried later.
  }

  return {
    artifactPath,
    uploaded: false,
    pending: true,
    assetCount: artifact.scan.assets.length,
  };
}

export async function syncPendingInitialGraphArtifacts(
  options: InitialGraphSyncOptions
): Promise<InitialGraphSyncResult> {
  const credentialManager = options.credentialManager ?? new CredentialManager();
  const installDir = options.installDir ?? resolveCliPaths().installDir;
  const normalizedTargetApiUrl = normalizeApiUrl(options.apiUrl);
  const artifactPaths = listArtifactPaths(installDir);
  const syncableArtifacts = artifactPaths.filter((artifactPath) => {
    const artifact = readArtifact(artifactPath);
    return artifact?.targetApiUrl === normalizedTargetApiUrl && !artifact.upload;
  });

  if (!credentialManager.loadTokens()?.accessToken) {
    return {
      uploaded: 0,
      pending: syncableArtifacts.length,
      artifactPaths: syncableArtifacts,
    };
  }

  let uploaded = 0;
  for (const artifactPath of syncableArtifacts) {
    const artifact = readArtifact(artifactPath);
    if (!artifact) {
      continue;
    }

    try {
      const uploadResult = await uploadArtifact(artifact, {
        apiUrl: normalizedTargetApiUrl,
        credentialManager,
      });

      if (uploadResult.uploaded && uploadResult.scanId) {
        await storeArtifactWithUploadState(installDir, artifact, {
          scanId: uploadResult.scanId,
          assetCount: uploadResult.assetCount,
        });
        uploaded += 1;
      }
    } catch {
      // Keep pending for a future retry.
    }
  }

  return {
    uploaded,
    pending: syncableArtifacts.length - uploaded,
    artifactPaths: syncableArtifacts,
  };
}
