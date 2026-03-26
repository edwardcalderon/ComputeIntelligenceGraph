export interface PublishedImageManifest {
  version: string;
  source_tag?: string;
  source_sha?: string;
  registry?: string;
  images: Record<string, string>;
}

const DEFAULT_RELEASE_BASE_URL = 'https://github.com/edwardcalderon/ComputeIntelligenceGraph/releases/download';

export function resolveImageManifestUrl(version: string): string {
  const override = process.env['CIG_IMAGE_MANIFEST_URL']?.trim();
  if (override) {
    return override.replace(/\{version\}/g, version);
  }

  return `${DEFAULT_RELEASE_BASE_URL}/cli-v${version}/images.json`;
}

function assertManifestShape(manifest: unknown, version: string): PublishedImageManifest {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Published image manifest is not valid JSON.');
  }

  const data = manifest as Partial<PublishedImageManifest> & { images?: unknown };
  if (data.version !== version) {
    throw new Error(`Published image manifest version mismatch: expected ${version}, received ${data.version ?? 'unknown'}.`);
  }

  if (!data.images || typeof data.images !== 'object') {
    throw new Error('Published image manifest is missing service image references.');
  }

  const images = data.images as Record<string, unknown>;
  for (const service of ['api', 'dashboard', 'discovery', 'cartography']) {
    if (typeof images[service] !== 'string' || String(images[service]).trim() === '') {
      throw new Error(`Published image manifest is missing a pinned image for ${service}.`);
    }
  }

  return {
    version: data.version,
    source_tag: data.source_tag,
    source_sha: data.source_sha,
    registry: data.registry,
    images: images as Record<string, string>,
  };
}

export async function resolvePublishedImageManifest(
  version: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<PublishedImageManifest> {
  const url = resolveImageManifestUrl(version);
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch published image manifest from ${url}: ${response.status} ${response.statusText}`);
  }

  const manifest = (await response.json()) as unknown;
  return assertManifestShape(manifest, version);
}
