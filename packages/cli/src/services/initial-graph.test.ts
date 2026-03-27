import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CredentialManager } from '../credentials.js';
import {
  seedInitialGraph,
  syncPendingInitialGraphArtifacts,
} from './initial-graph.js';

describe('initial graph seeding', () => {
  let tmpDir: string;
  let credentialManager: CredentialManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cig-graph-'));
    credentialManager = new CredentialManager({
      paths: {
        configDir: path.join(tmpDir, 'config'),
        installDir: path.join(tmpDir, 'install'),
      },
      encryptionSeed: 'test-seed',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('persists a pending initial graph artifact when auth is unavailable', async () => {
    const result = await seedInitialGraph({
      installDir: path.join(tmpDir, 'install'),
      apiUrl: 'http://localhost:3003',
      mode: 'self-hosted',
      profile: 'discovery',
      credentialManager,
    });

    expect(result.uploaded).toBe(false);
    expect(result.pending).toBe(true);
    expect(fs.existsSync(result.artifactPath)).toBe(true);

    const artifact = JSON.parse(fs.readFileSync(result.artifactPath, 'utf8')) as {
      targetApiUrl: string;
      scan: { scan_type: string };
    };

    expect(artifact.targetApiUrl).toBe('http://127.0.0.1:3003');
    expect(artifact.scan.scan_type).toBe('local');
  });

  it('uploads a pending initial graph snapshot after auth becomes available', async () => {
    const artifactPath = await seedInitialGraph({
      installDir: path.join(tmpDir, 'install'),
      apiUrl: 'http://localhost:3003',
      mode: 'self-hosted',
      profile: 'discovery',
      credentialManager,
    }).then((result) => result.artifactPath);

    credentialManager.saveTokens({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 60 * 60 * 1000,
      refreshExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ scan_id: 'scan-123', asset_count: 7 }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    const syncResult = await syncPendingInitialGraphArtifacts({
      apiUrl: 'http://localhost:3003',
      installDir: path.join(tmpDir, 'install'),
      credentialManager,
    });

    expect(syncResult.uploaded).toBe(1);
    expect(syncResult.pending).toBe(0);
    expect(syncResult.artifactPaths).toContain(artifactPath);

    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as {
      upload?: { scanId: string };
    };

    expect(artifact.upload?.scanId).toBe('scan-123');
  });
});
