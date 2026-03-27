/**
 * Integration tests for the conversational interface components.
 * Validates: Requirements 26.2
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VectorStore, type VectorDocument } from './vectordb.js';
import { RAGPipeline, EmbeddingService, type ResourceDoc } from './rag.js';
import type { ChatMessage } from './types.js';

// ─── VectorStore ──────────────────────────────────────────────────────────────
// We test VectorStore by injecting a mock Collection directly, bypassing connect().

describe('VectorStore', () => {
  // Build a minimal mock collection and inject it via the private field
  function makeStore() {
    const mockCol = {
      upsert: vi.fn().mockResolvedValue(undefined),
      query: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    // Bypass the singleton by directly setting the private collection field
    const store = Object.create(VectorStore.prototype) as InstanceType<typeof VectorStore>;
    // Inject mock collection into private field
    (store as unknown as Record<string, unknown>)['collection'] = mockCol;
    return { store, mockCol };
  }

  it('addDocuments stores documents via upsert', async () => {
    const { store, mockCol } = makeStore();
    const docs: VectorDocument[] = [
      { id: 'r1', content: 'ec2 instance', metadata: { type: 'EC2' } },
    ];
    await store.addDocuments(docs);
    expect(mockCol.upsert).toHaveBeenCalledWith({
      ids: ['r1'],
      documents: ['ec2 instance'],
      metadatas: [{ type: 'EC2' }],
    });
  });

  it('query returns matching documents', async () => {
    const { store, mockCol } = makeStore();
    mockCol.query.mockResolvedValueOnce({
      ids: [['r1', 'r2']],
      documents: [['ec2 instance', 's3 bucket']],
      metadatas: [[{ type: 'EC2' }, { type: 'S3' }]],
    });

    const results = await store.query([0.1, 0.2], 2);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ id: 'r1', content: 'ec2 instance', metadata: { type: 'EC2' } });
    expect(results[1]).toEqual({ id: 'r2', content: 's3 bucket', metadata: { type: 'S3' } });
  });

  it('deleteDocument removes a document by id', async () => {
    const { store, mockCol } = makeStore();
    await store.deleteDocument('r1');
    expect(mockCol.delete).toHaveBeenCalledWith({ ids: ['r1'] });
  });
});

// ─── RAGPipeline ──────────────────────────────────────────────────────────────

describe('RAGPipeline', () => {
  const fakeEmbedding = [0.1, 0.2, 0.3];

  function makePipeline() {
    const mockStore = {
      addDocumentsWithEmbeddings: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      deleteDocument: vi.fn().mockResolvedValue(undefined),
    };

    // Mock EmbeddingService as a plain object — avoids OpenAI key validation
    const mockEmbeddingService = {
      embedText: vi.fn().mockResolvedValue(fakeEmbedding),
      embedResource: vi.fn().mockResolvedValue(fakeEmbedding),
    };

    const pipeline = new RAGPipeline(
      mockStore as unknown as VectorStore,
      mockEmbeddingService as unknown as EmbeddingService,
    );

    return { pipeline, mockStore, mockEmbeddingService };
  }

  it('indexResource calls embedResource and addDocumentsWithEmbeddings', async () => {
    const { pipeline, mockStore, mockEmbeddingService } = makePipeline();
    const resource: ResourceDoc = {
      id: 'res-1',
      name: 'my-ec2',
      type: 'EC2',
      provider: 'aws',
      region: 'us-east-1',
      state: 'running',
    };

    await pipeline.indexResource(resource);

    expect(mockEmbeddingService.embedResource).toHaveBeenCalledWith(resource);
    expect(mockStore.addDocumentsWithEmbeddings).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'res-1', content: expect.stringContaining('my-ec2') })],
      [fakeEmbedding],
    );
  });

  it('indexResources indexes each resource in sequence', async () => {
    const { pipeline, mockStore, mockEmbeddingService } = makePipeline();
    const resources: ResourceDoc[] = [
      {
        id: 'res-1',
        name: 'my-ec2',
        type: 'EC2',
        provider: 'aws',
      },
      {
        id: 'res-2',
        name: 'my-bucket',
        type: 'S3',
        provider: 'aws',
      },
    ];

    await pipeline.indexResources(resources);

    expect(mockEmbeddingService.embedResource).toHaveBeenNthCalledWith(1, resources[0]);
    expect(mockEmbeddingService.embedResource).toHaveBeenNthCalledWith(2, resources[1]);
    expect(mockStore.addDocumentsWithEmbeddings).toHaveBeenCalledTimes(2);
  });

  it('retrieve calls embedText and queries the vector store', async () => {
    const { pipeline, mockStore, mockEmbeddingService } = makePipeline();
    mockStore.query.mockResolvedValueOnce([
      { id: 'r1', content: 'some resource', metadata: {} },
    ]);

    const results = await pipeline.retrieve('find ec2 instances', 5);

    expect(mockEmbeddingService.embedText).toHaveBeenCalledWith('find ec2 instances');
    expect(mockStore.query).toHaveBeenCalledWith(fakeEmbedding, 5);
    expect(results).toHaveLength(1);
  });

  it('assembleContext returns formatted string with infrastructure context and conversation history', async () => {
    const { pipeline, mockStore } = makePipeline();
    mockStore.query.mockResolvedValueOnce([
      {
        id: 'r1',
        content: 'my-ec2 EC2 aws',
        metadata: { name: 'my-ec2', type: 'EC2', provider: 'aws', region: 'us-east-1', state: 'running' },
      },
    ]);

    const history: ChatMessage[] = [
      { role: 'user', content: 'hello', timestamp: new Date() },
      { role: 'assistant', content: 'hi there', timestamp: new Date() },
    ];

    const context = await pipeline.assembleContext('list resources', history);

    expect(context).toContain('Infrastructure context:');
    expect(context).toContain('my-ec2');
    expect(context).toContain('Conversation history:');
    expect(context).toContain('User: hello');
    expect(context).toContain('Assistant: hi there');
  });

  it('removeResource calls deleteDocument with the resource id', async () => {
    const { pipeline, mockStore } = makePipeline();
    await pipeline.removeResource('res-1');
    expect(mockStore.deleteDocument).toHaveBeenCalledWith('res-1');
  });
});
