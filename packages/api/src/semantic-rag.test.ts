import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider, ResourceState, ResourceType, type Resource_Model } from '@cig/graph';

const ragMocks = vi.hoisted(() => ({
  vectorStoreCtor: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  indexResources: vi.fn().mockResolvedValue(undefined),
  removeResource: vi.fn().mockResolvedValue(undefined),
  retrieve: vi.fn(),
  getResource: vi.fn(),
  getRelationships: vi.fn(),
  listResourcesPaged: vi.fn(),
}));

vi.mock('@cig/graph', async () => {
  const actual = await vi.importActual<typeof import('@cig/graph')>('@cig/graph');
  return {
    ...actual,
    GraphEngine: vi.fn().mockImplementation(() => ({
      getResource: ragMocks.getResource,
      getRelationships: ragMocks.getRelationships,
    })),
    GraphQueryEngine: vi.fn().mockImplementation(() => ({
      listResourcesPaged: ragMocks.listResourcesPaged,
    })),
  };
});

vi.mock('@cig/chatbot', () => ({
  VectorStore: vi.fn().mockImplementation((options?: { collectionName?: string }) => {
    ragMocks.vectorStoreCtor(options);
    return {
      connect: ragMocks.connect,
      addDocuments: vi.fn(),
      addDocumentsWithEmbeddings: vi.fn(),
      query: vi.fn(),
      deleteDocument: vi.fn(),
    };
  }),
  EmbeddingService: vi.fn().mockImplementation(() => ({})),
  RAGPipeline: vi.fn().mockImplementation(() => ({
    indexResources: ragMocks.indexResources,
    removeResource: ragMocks.removeResource,
    retrieve: ragMocks.retrieve,
  })),
}));

function makeResource(overrides: Partial<Resource_Model> = {}): Resource_Model {
  const now = new Date('2026-03-27T00:00:00.000Z');
  return {
    id: 'svc-prod-api',
    name: 'prod-api',
    type: ResourceType.SERVICE,
    provider: Provider.AWS,
    region: 'us-east-1',
    zone: undefined,
    state: ResourceState.RUNNING,
    tags: { env: 'prod' },
    metadata: { owner: 'platform' },
    cost: 42,
    createdAt: now,
    updatedAt: now,
    discoveredAt: now,
    ...overrides,
  };
}

describe('semantic-rag', () => {
  beforeEach(async () => {
    process.env['OPENAI_API_KEY'] = 'test-openai-key';
    ragMocks.vectorStoreCtor.mockClear();
    ragMocks.connect.mockClear();
    ragMocks.indexResources.mockClear();
    ragMocks.removeResource.mockClear();
    ragMocks.retrieve.mockReset();
    ragMocks.retrieve.mockResolvedValue([]);
    ragMocks.getResource.mockReset();
    ragMocks.getRelationships.mockReset();
    ragMocks.listResourcesPaged.mockReset();
    ragMocks.listResourcesPaged.mockResolvedValue({
      items: [],
      total: 0,
      hasMore: false,
    });
    const { resetSemanticRagCache } = await import('./semantic-rag');
    resetSemanticRagCache();
  });

  afterEach(() => {
    delete process.env['OPENAI_API_KEY'];
  });

  it('indexes graph delta additions and modifications, then removes deletions', async () => {
    const { indexGraphDeltaResources } = await import('./semantic-rag');

    ragMocks.getResource
      .mockResolvedValueOnce(makeResource({ id: 'res-1', name: 'cache-1' }))
      .mockResolvedValueOnce(makeResource({ id: 'res-2', name: 'db-1' }));
    ragMocks.getRelationships.mockResolvedValue([]);

    await indexGraphDeltaResources(
      {
        additions: [
          { id: 'res-1', type: 'service', provider: 'aws', properties: {} },
        ],
        modifications: [
          { id: 'res-2', properties: { state: 'running' } },
        ],
        deletions: ['res-3'],
      } as never
    );

    expect(ragMocks.connect).toHaveBeenCalledTimes(1);
    expect(ragMocks.indexResources).toHaveBeenCalledTimes(1);
    const [documents] = ragMocks.indexResources.mock.calls[0] ?? [];
    expect(documents).toEqual([
      expect.objectContaining({ id: 'res-1', name: 'cache-1' }),
      expect.objectContaining({ id: 'res-2', name: 'db-1' }),
    ]);
    expect(ragMocks.removeResource).toHaveBeenCalledWith('res-3');
  });

  it('retrieves semantic matches and hydrates actual graph resources', async () => {
    const { retrieveSemanticResources } = await import('./semantic-rag');

    ragMocks.retrieve.mockResolvedValueOnce([
      { id: 'res-1', content: 'prod-api service aws', metadata: {} },
      { id: 'res-2', content: 'old bucket s3 aws', metadata: {} },
    ]);
    ragMocks.getResource
      .mockResolvedValueOnce(makeResource({ id: 'res-1', name: 'prod-api' }))
      .mockResolvedValueOnce(null);

    const resources = await retrieveSemanticResources('production api', 5);

    expect(ragMocks.retrieve).toHaveBeenCalledWith('production api', 5);
    expect(resources).toHaveLength(1);
    expect(resources[0]?.id).toBe('res-1');
  });

  it('backs up the semantic index from the live graph snapshot', async () => {
    const { syncSemanticIndex } = await import('./semantic-rag');

    ragMocks.listResourcesPaged
      .mockResolvedValueOnce({
        items: [makeResource({ id: 'res-1', name: 'cache-1' })],
        total: 2,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [makeResource({ id: 'res-2', name: 'db-1' })],
        total: 2,
        hasMore: false,
      });

    const result = await syncSemanticIndex();

    expect(result.indexed).toBe(2);
    expect(ragMocks.listResourcesPaged).toHaveBeenNthCalledWith(1, undefined, {
      limit: 250,
      offset: 0,
    }, undefined);
    expect(ragMocks.listResourcesPaged).toHaveBeenNthCalledWith(2, undefined, {
      limit: 250,
      offset: 1,
    }, undefined);
    expect(ragMocks.indexResources).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({ id: 'res-1', name: 'cache-1' }),
    ]);
    expect(ragMocks.indexResources).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({ id: 'res-2', name: 'db-1' }),
    ]);
  });

  it('uses a distinct Chroma collection per managed user and tenant scope', async () => {
    const { retrieveSemanticResources } = await import('./semantic-rag');

    ragMocks.retrieve.mockResolvedValue([]);

    await retrieveSemanticResources('production api', 5, {
      deploymentMode: 'managed',
      tenant: 'workspace-a',
      userId: 'user-a',
    });
    await retrieveSemanticResources('production api', 5, {
      deploymentMode: 'managed',
      tenant: 'workspace-b',
      userId: 'user-b',
    });

    expect(ragMocks.vectorStoreCtor).toHaveBeenCalledTimes(2);
    const firstCollectionName = ragMocks.vectorStoreCtor.mock.calls[0]?.[0]?.collectionName as string | undefined;
    const secondCollectionName = ragMocks.vectorStoreCtor.mock.calls[1]?.[0]?.collectionName as string | undefined;

    expect(firstCollectionName).toMatch(/^infrastructure_resources__/);
    expect(secondCollectionName).toMatch(/^infrastructure_resources__/);
    expect(firstCollectionName).not.toBe(secondCollectionName);
  });
});
