import { ChromaClient, Collection, type Metadata } from 'chromadb';

export interface VectorDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

const COLLECTION_NAME = 'infrastructure_resources';

// Singleton client instance (connection pooling via reuse)
let clientInstance: ChromaClient | null = null;
let collectionInstance: Collection | null = null;

export class VectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;

  constructor() {
    if (!clientInstance) {
      const url = process.env.CHROMA_URL ?? 'http://localhost:8000';
      clientInstance = new ChromaClient({ path: url });
    }
    this.client = clientInstance;
  }

  async connect(): Promise<void> {
    if (collectionInstance) {
      this.collection = collectionInstance;
      return;
    }
    this.collection = await this.client.getOrCreateCollection({
      name: COLLECTION_NAME,
    });
    collectionInstance = this.collection;
  }

  private ensureConnected(): Collection {
    if (!this.collection) {
      throw new Error('VectorStore not connected. Call connect() first.');
    }
    return this.collection;
  }

  async addDocuments(docs: VectorDocument[]): Promise<void> {
    const col = this.ensureConnected();
    await col.upsert({
      ids: docs.map((d) => d.id),
      documents: docs.map((d) => d.content),
      metadatas: docs.map((d) => d.metadata as Metadata),
    });
  }

  async addDocumentsWithEmbeddings(
    docs: VectorDocument[],
    embeddings: number[][],
  ): Promise<void> {
    const col = this.ensureConnected();
    await col.upsert({
      ids: docs.map((d) => d.id),
      documents: docs.map((d) => d.content),
      metadatas: docs.map((d) => d.metadata as Metadata),
      embeddings,
    });
  }

  async query(embedding: number[], topK: number): Promise<VectorDocument[]> {
    const col = this.ensureConnected();
    const results = await col.query({
      queryEmbeddings: [embedding],
      nResults: topK,
    });

    const ids = results.ids[0] ?? [];
    const documents = results.documents[0] ?? [];
    const metadatas = results.metadatas[0] ?? [];

    return ids.map((id, i) => ({
      id,
      content: documents[i] ?? '',
      metadata: (metadatas[i] as Record<string, unknown>) ?? {},
    }));
  }

  async deleteDocument(id: string): Promise<void> {
    const col = this.ensureConnected();
    await col.delete({ ids: [id] });
  }
}
