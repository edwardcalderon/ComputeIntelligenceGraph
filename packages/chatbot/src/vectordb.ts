import { ChromaClient, CloudClient, Collection, type Metadata } from 'chromadb';

export interface VectorDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

const COLLECTION_NAME = 'infrastructure_resources';

// Singleton client instance (connection pooling via reuse)
let clientInstance: ChromaClient | null = null;
let collectionInstance: Collection | null = null;

export interface ChromaConnectionConfig {
  mode: 'cloud' | 'local';
  path?: string;
  apiKey?: string;
  tenant?: string;
  database?: string;
  cloudHost?: string;
}

function normalizeCloudHost(host: string): string {
  const trimmed = host.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function resolveChromaConnectionConfig(): ChromaConnectionConfig {
  const cloudApiKey = process.env.CHROMA_API_KEY?.trim();
  const cloudTenant = process.env.CHROMA_TENANT?.trim();
  const cloudDatabase = process.env.CHROMA_DATABASE?.trim();
  const cloudHost = process.env.CHROMA_HOST?.trim();

  if (cloudApiKey) {
    if (!cloudTenant || !cloudDatabase) {
      throw new Error(
        'CHROMA_TENANT and CHROMA_DATABASE are required when CHROMA_API_KEY is set.',
      );
    }

    return {
      mode: 'cloud',
      apiKey: cloudApiKey,
      tenant: cloudTenant,
      database: cloudDatabase,
      cloudHost: normalizeCloudHost(cloudHost || 'api.trychroma.com'),
    };
  }

  const url = process.env.CHROMA_URL ?? 'http://localhost:8000';
  return {
    mode: 'local',
    path: url,
  };
}

function createClient(): ChromaClient {
  const config = resolveChromaConnectionConfig();

  if (config.mode === 'cloud') {
    return new CloudClient({
      apiKey: config.apiKey,
      tenant: config.tenant,
      database: config.database,
      cloudHost: config.cloudHost,
    });
  }

  return new ChromaClient({ path: config.path });
}

export class VectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;

  constructor() {
    if (!clientInstance) {
      clientInstance = createClient();
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
