/**
 * manifest.test.ts — Unit tests for resolveManifest and fetchManifestFromUrl
 *
 * Requirements: 5.1, 5.2, 21.7
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deserializeManifest, serializeManifest, signManifest } from '@cig/sdk';
import type { SetupManifest } from '@cig/sdk';
import { fetchManifestFromUrl, resolveManifest } from './manifest.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SIGNING_KEY = 'test-signing-key-abc123';

function makeManifest(overrides: Partial<SetupManifest> = {}): SetupManifest {
  const base: Omit<SetupManifest, 'signature'> = {
    version: '1.0',
    cloudProvider: 'aws',
    credentialsRef: 'arn:aws:iam::123456789012:role/CIGRole',
    enrollmentToken: 'token-uuid-1234',
    nodeIdentitySeed: 'seed-fingerprint-abc',
    installProfile: 'core',
    targetMode: 'local',
    controlPlaneEndpoint: 'https://api.cig.lat',
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min from now
    ...overrides,
  };
  return signManifest(base, SIGNING_KEY);
}

function encodeManifest(manifest: SetupManifest): string {
  return serializeManifest(manifest);
}

// ---------------------------------------------------------------------------
// fetchManifestFromUrl
// ---------------------------------------------------------------------------

describe('fetchManifestFromUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and returns the response text', async () => {
    const manifest = makeManifest();
    const encoded = encodeManifest(manifest);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => encoded,
    }));

    const result = await fetchManifestFromUrl('https://api.cig.lat/manifest/abc');
    expect(result).toBe(encoded);
  });

  it('sends Authorization header when access token is provided', async () => {
    const manifest = makeManifest();
    const encoded = encodeManifest(manifest);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => encoded,
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchManifestFromUrl('https://api.cig.lat/manifest/abc', 'my-token');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.cig.lat/manifest/abc',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer my-token' }),
      })
    );
  });

  it('throws on non-OK HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => '',
    }));

    await expect(
      fetchManifestFromUrl('https://api.cig.lat/manifest/abc')
    ).rejects.toThrow('HTTP 403 Forbidden');
  });

  it('throws on empty response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '   ',
    }));

    await expect(
      fetchManifestFromUrl('https://api.cig.lat/manifest/abc')
    ).rejects.toThrow('empty response');
  });
});

// ---------------------------------------------------------------------------
// resolveManifest — inline base64
// ---------------------------------------------------------------------------

describe('resolveManifest (inline base64)', () => {
  beforeEach(() => {
    delete process.env['MANIFEST_SIGNING_KEY'];
    delete process.env['CIG_MANIFEST_KEY'];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['MANIFEST_SIGNING_KEY'];
    delete process.env['CIG_MANIFEST_KEY'];
  });

  it('decodes and returns a valid manifest without a signing key', async () => {
    const manifest = makeManifest();
    const encoded = encodeManifest(manifest);

    const result = await resolveManifest(encoded);
    expect(result.version).toBe('1.0');
    expect(result.cloudProvider).toBe('aws');
    expect(result.enrollmentToken).toBe('token-uuid-1234');
  });

  it('verifies signature when MANIFEST_SIGNING_KEY is set', async () => {
    process.env['MANIFEST_SIGNING_KEY'] = SIGNING_KEY;
    const manifest = makeManifest();
    const encoded = encodeManifest(manifest);

    const result = await resolveManifest(encoded);
    expect(result.enrollmentToken).toBe('token-uuid-1234');
  });

  it('verifies signature when CIG_MANIFEST_KEY is set', async () => {
    process.env['CIG_MANIFEST_KEY'] = SIGNING_KEY;
    const manifest = makeManifest();
    const encoded = encodeManifest(manifest);

    const result = await resolveManifest(encoded);
    expect(result.enrollmentToken).toBe('token-uuid-1234');
  });

  it('throws on invalid signature', async () => {
    process.env['MANIFEST_SIGNING_KEY'] = 'wrong-key';
    const manifest = makeManifest();
    const encoded = encodeManifest(manifest);

    await expect(resolveManifest(encoded)).rejects.toThrow(
      'Manifest signature verification failed. The manifest may have been tampered with.'
    );
  });

  it('throws when manifest has expired', async () => {
    const manifest = makeManifest({
      expiresAt: new Date(Date.now() - 1000).toISOString(), // 1 second ago
    });
    const encoded = encodeManifest(manifest);

    await expect(resolveManifest(encoded)).rejects.toThrow(
      'Manifest has expired. Please regenerate the manifest from the Dashboard.'
    );
  });

  it('throws on invalid base64 input', async () => {
    await expect(resolveManifest('!!!not-valid-base64!!!')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// resolveManifest — URL input
// ---------------------------------------------------------------------------

describe('resolveManifest (URL)', () => {
  beforeEach(() => {
    delete process.env['MANIFEST_SIGNING_KEY'];
    delete process.env['CIG_MANIFEST_KEY'];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['MANIFEST_SIGNING_KEY'];
    delete process.env['CIG_MANIFEST_KEY'];
  });

  it('fetches from URL and returns decoded manifest', async () => {
    const manifest = makeManifest();
    const encoded = encodeManifest(manifest);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => encoded,
    }));

    const result = await resolveManifest('https://api.cig.lat/manifest/abc');
    expect(result.cloudProvider).toBe('aws');
  });

  it('passes access token to fetch', async () => {
    const manifest = makeManifest();
    const encoded = encodeManifest(manifest);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => encoded,
    });
    vi.stubGlobal('fetch', mockFetch);

    await resolveManifest('https://api.cig.lat/manifest/abc', 'bearer-token');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.cig.lat/manifest/abc',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer bearer-token' }),
      })
    );
  });

  it('aborts with signature error if fetched manifest has wrong signature', async () => {
    process.env['MANIFEST_SIGNING_KEY'] = 'wrong-key';
    const manifest = makeManifest();
    const encoded = encodeManifest(manifest);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => encoded,
    }));

    await expect(
      resolveManifest('https://api.cig.lat/manifest/abc')
    ).rejects.toThrow('Manifest signature verification failed');
  });

  it('aborts with expiry error if fetched manifest is expired', async () => {
    const manifest = makeManifest({
      expiresAt: new Date(Date.now() - 5000).toISOString(),
    });
    const encoded = encodeManifest(manifest);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => encoded,
    }));

    await expect(
      resolveManifest('https://api.cig.lat/manifest/abc')
    ).rejects.toThrow('Manifest has expired');
  });
});
