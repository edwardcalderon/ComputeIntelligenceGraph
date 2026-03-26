import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveChromaConnectionConfig } from './vectordb';

describe('VectorStore Chroma connection config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves cloud configuration when Chroma Cloud credentials are present', () => {
    vi.stubEnv('CHROMA_HOST', 'api.trychroma.com');
    vi.stubEnv('CHROMA_API_KEY', 'cloud-api-key');
    vi.stubEnv('CHROMA_TENANT', 'tenant-123');
    vi.stubEnv('CHROMA_DATABASE', 'cig');

    expect(resolveChromaConnectionConfig()).toEqual({
      mode: 'cloud',
      apiKey: 'cloud-api-key',
      tenant: 'tenant-123',
      database: 'cig',
      cloudHost: 'https://api.trychroma.com',
      collectionName: 'infrastructure_resources',
    });
  });

  it('falls back to the local Chroma URL when cloud credentials are absent', () => {
    vi.stubEnv('CHROMA_URL', 'http://localhost:8000');

    expect(resolveChromaConnectionConfig()).toEqual({
      mode: 'local',
      path: 'http://localhost:8000',
      collectionName: 'infrastructure_resources',
    });
  });

  it('rejects incomplete cloud configuration', () => {
    vi.stubEnv('CHROMA_API_KEY', 'cloud-api-key');
    vi.stubEnv('CHROMA_TENANT', 'tenant-123');

    expect(() => resolveChromaConnectionConfig()).toThrow(
      'CHROMA_TENANT and CHROMA_DATABASE are required when CHROMA_API_KEY is set.'
    );
  });

  it('honors a custom collection name when provided', () => {
    vi.stubEnv('CHROMA_URL', 'http://localhost:8000');
    vi.stubEnv('CHROMA_COLLECTION', 'cig_custom_collection');

    expect(resolveChromaConnectionConfig()).toEqual({
      mode: 'local',
      path: 'http://localhost:8000',
      collectionName: 'cig_custom_collection',
    });
  });
});
