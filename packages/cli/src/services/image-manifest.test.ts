import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resolveImageManifestUrl,
  resolvePublishedImageManifest,
} from './image-manifest.js';

describe('image manifest resolver', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds the release asset URL from the CLI version', () => {
    expect(resolveImageManifestUrl('0.1.11')).toBe(
      'https://github.com/edwardcalderon/ComputeIntelligenceGraph/releases/download/cli-v0.1.11/images.json'
    );
  });

  it('supports a URL override template', () => {
    vi.stubEnv('CIG_IMAGE_MANIFEST_URL', 'https://example.com/manifests/{version}.json');

    expect(resolveImageManifestUrl('0.1.11')).toBe('https://example.com/manifests/0.1.11.json');
  });

  it('loads and validates a published manifest', async () => {
    const manifest = {
      version: '0.1.11',
      images: {
        api: 'docker.io/cigtechnology/cig-api@sha256:1111111111111111111111111111111111111111111111111111111111111111',
        dashboard: 'docker.io/cigtechnology/cig-dashboard@sha256:2222222222222222222222222222222222222222222222222222222222222222',
        discovery: 'docker.io/cigtechnology/cig-discovery@sha256:3333333333333333333333333333333333333333333333333333333333333333',
        cartography: 'docker.io/cigtechnology/cig-cartography@sha256:4444444444444444444444444444444444444444444444444444444444444444',
      },
    };

    const result = await resolvePublishedImageManifest('0.1.11', async () =>
      new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    expect(result.version).toBe('0.1.11');
    expect(result.images.api).toContain('cig-api@sha256:');
  });

  it('rejects a manifest that does not match the CLI version', async () => {
    await expect(
      resolvePublishedImageManifest('0.1.11', async () =>
        new Response(JSON.stringify({ version: '0.1.10', images: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    ).rejects.toThrow('version mismatch');
  });
});
