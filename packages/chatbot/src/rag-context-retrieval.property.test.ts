/**
 * Property 16: RAG Context Retrieval
 * Validates: Requirements 13.1, 13.2, 13.6
 *
 * For any query, the retrieved context contains at most topK results.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { RAGPipeline, EmbeddingService } from './rag';
import { VectorStore, VectorDocument } from './vectordb';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeVectorStore(docs: VectorDocument[]): VectorStore {
  return {
    query: vi.fn().mockResolvedValue(docs),
    addDocuments: vi.fn().mockResolvedValue(undefined),
    addDocumentsWithEmbeddings: vi.fn().mockResolvedValue(undefined),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
  } as unknown as VectorStore;
}

function makeEmbeddingService(): EmbeddingService {
  return {
    embedText: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
    embedResource: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
  } as unknown as EmbeddingService;
}

function makeDoc(id: string): VectorDocument {
  return {
    id,
    content: `Resource ${id}`,
    metadata: { name: `resource-${id}`, type: 'compute', provider: 'aws', region: 'us-east-1', state: 'running' },
  };
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const queryArb = fc.string({ minLength: 1, maxLength: 200 });

const topKArb = fc.integer({ min: 1, max: 20 });

/**
 * Generates a pool of documents (0 to 25) and a topK value.
 * The mock returns min(topK, poolSize) docs — simulating real ChromaDB behavior.
 */
const retrievalScenarioArb = fc.tuple(
  queryArb,
  topKArb,
  fc.integer({ min: 0, max: 25 }),
);

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 16: RAG Context Retrieval', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retrieve() returns at most topK documents for any query', async () => {
    /**
     * Validates: Requirements 13.1, 13.2
     * For any query and topK value, the number of retrieved documents must
     * never exceed topK.
     */
    await fc.assert(
      fc.asyncProperty(retrievalScenarioArb, async ([query, topK, poolSize]) => {
        // The store returns min(topK, poolSize) docs (simulating real behavior)
        const returnCount = Math.min(topK, poolSize);
        const docs = Array.from({ length: returnCount }, (_, i) => makeDoc(`doc-${i}`));

        const store = makeVectorStore(docs);
        const embedder = makeEmbeddingService();
        const pipeline = new RAGPipeline(store, embedder);

        const results = await pipeline.retrieve(query, topK);

        expect(results.length).toBeLessThanOrEqual(topK);
      }),
      { numRuns: 100 }
    );
  });

  it('assembleContext() produces a non-empty string for any query', async () => {
    /**
     * Validates: Requirements 13.6
     * assembleContext() must always return a non-empty string, even when
     * no documents are retrieved.
     */
    await fc.assert(
      fc.asyncProperty(queryArb, async (query) => {
        const store = makeVectorStore([]);
        const embedder = makeEmbeddingService();
        const pipeline = new RAGPipeline(store, embedder);

        const context = await pipeline.assembleContext(query, []);

        expect(typeof context).toBe('string');
        expect(context.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 }
    );
  });

  it('retrieve() passes the exact topK value to the vector store', async () => {
    /**
     * Validates: Requirements 13.2
     * The topK parameter must be forwarded unchanged to the underlying
     * vector store query.
     */
    await fc.assert(
      fc.asyncProperty(queryArb, topKArb, async (query, topK) => {
        const store = makeVectorStore([]);
        const embedder = makeEmbeddingService();
        const pipeline = new RAGPipeline(store, embedder);

        await pipeline.retrieve(query, topK);

        expect(store.query).toHaveBeenCalledWith(expect.any(Array), topK);
      }),
      { numRuns: 50 }
    );
  });
});
