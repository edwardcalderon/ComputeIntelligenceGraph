import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Resource_Model } from '@cig/graph';

const graphMocks = vi.hoisted(() => ({
  createResource: vi.fn().mockResolvedValue(undefined),
  createRelationship: vi.fn().mockResolvedValue(undefined),
  deleteResource: vi.fn().mockResolvedValue(undefined),
  listResources: vi.fn(),
  listResourcesPaged: vi.fn(),
  listRelationships: vi.fn(),
}));

const semanticMocks = vi.hoisted(() => ({
  syncSemanticIndex: vi.fn().mockResolvedValue({ indexed: 0 }),
}));

let demoState: {
  source: 'demo';
  seed_version: string;
  seeded_at: string;
  seeded_by: string;
  resource_count: number;
  relationship_count: number;
  semantic_collection: string;
  updated_at: string;
} | null = null;

vi.mock('@cig/graph', async () => {
  const actual = await vi.importActual<typeof import('@cig/graph')>('@cig/graph');
  return {
    ...actual,
    GraphEngine: vi.fn().mockImplementation(() => ({
      createResource: graphMocks.createResource,
      createRelationship: graphMocks.createRelationship,
      deleteResource: graphMocks.deleteResource,
    })),
    GraphQueryEngine: vi.fn().mockImplementation(() => ({
      listResources: graphMocks.listResources,
      listResourcesPaged: graphMocks.listResourcesPaged,
      listRelationships: graphMocks.listRelationships,
      getResourceCounts: vi.fn().mockResolvedValue({}),
    })),
  };
});

vi.mock('./semantic-rag', async () => {
  const actual = await vi.importActual<typeof import('./semantic-rag')>('./semantic-rag');
  return {
    ...actual,
    syncSemanticIndex: semanticMocks.syncSemanticIndex,
  };
});

vi.mock('./db/client', () => ({
  query: vi.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes('FROM demo_workspace_state')) {
      return {
        rows: demoState ? [demoState] : [],
        rowCount: demoState ? 1 : 0,
      };
    }

    if (sql.startsWith('INSERT INTO demo_workspace_state')) {
      const [source, seedVersion, seededAt, seededBy, resourceCount, relationshipCount, semanticCollection, updatedAt] =
        params ?? [];
      demoState = {
        source: source as 'demo',
        seed_version: String(seedVersion),
        seeded_at: String(seededAt),
        seeded_by: String(seededBy),
        resource_count: Number(resourceCount),
        relationship_count: Number(relationshipCount),
        semantic_collection: String(semanticCollection),
        updated_at: String(updatedAt),
      };
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }),
}));

describe('demo-workspace', () => {
  beforeEach(() => {
    demoState = null;
    graphMocks.createResource.mockClear();
    graphMocks.createRelationship.mockClear();
    graphMocks.deleteResource.mockClear();
    graphMocks.listResources.mockReset();
    graphMocks.listResourcesPaged.mockReset();
    graphMocks.listRelationships.mockReset();
    graphMocks.listResources.mockResolvedValue([]);
    graphMocks.listResourcesPaged.mockResolvedValue({ items: [], total: 0, hasMore: false });
    graphMocks.listRelationships.mockResolvedValue([]);
    semanticMocks.syncSemanticIndex.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('provisions a persistent demo workspace and writes provisioning state', async () => {
    const { provisionDemoWorkspace } = await import('./demo-workspace');

    const status = await provisionDemoWorkspace({ force: true, seededBy: 'admin-1' });

    expect(graphMocks.deleteResource).not.toHaveBeenCalled();
    expect(graphMocks.createResource).toHaveBeenCalled();
    expect(graphMocks.createRelationship).toHaveBeenCalled();
    expect(semanticMocks.syncSemanticIndex).toHaveBeenCalledTimes(1);
    expect(status.source).toBe('demo');
    expect(status.resourceCount).toBeGreaterThan(0);
    expect(status.relationshipCount).toBeGreaterThan(0);
    expect(status.seededBy).toBe('admin-1');
    expect(demoState?.seeded_by).toBe('admin-1');
    expect(demoState?.resource_count).toBe(status.resourceCount);
    expect(demoState?.semantic_collection).toMatch(/^infrastructure_resources__/);
    expect(demoState?.semantic_collection).toBe(status.semanticCollection);
  });

  it('returns the existing demo workspace status when already provisioned', async () => {
    demoState = {
      source: 'demo',
      seed_version: '2026-03-27.1',
      seeded_at: '2026-03-27T00:00:00.000Z',
      seeded_by: 'system',
      resource_count: 9,
      relationship_count: 9,
      semantic_collection: 'infrastructure_resources__seeded',
      updated_at: '2026-03-27T00:00:00.000Z',
    };

    const { ensureDemoWorkspaceProvisioned } = await import('./demo-workspace');

    const status = await ensureDemoWorkspaceProvisioned();

    expect(status.resourceCount).toBe(9);
    expect(graphMocks.createResource).not.toHaveBeenCalled();
    expect(semanticMocks.syncSemanticIndex).not.toHaveBeenCalled();
  });
});
