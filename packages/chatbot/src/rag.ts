import { OpenAIEmbeddings } from '@langchain/openai';
import { VectorStore, VectorDocument } from './vectordb';
import { ChatMessage } from './types';

export interface ResourceDoc {
  id: string;
  name: string;
  type: string;
  provider: string;
  region?: string;
  state?: string;
  tags?: Record<string, string>;
  relationships?: string[];
}

function buildResourceText(resource: ResourceDoc): string {
  const tags = resource.tags
    ? Object.entries(resource.tags)
        .map(([k, v]) => `${k}=${v}`)
        .join(',')
    : '';
  const deps = resource.relationships ? resource.relationships.join(',') : '';
  return `${resource.name} ${resource.type} ${resource.provider} ${resource.region ?? ''} ${resource.state ?? ''} tags:${tags} deps:${deps}`.trim();
}

export class EmbeddingService {
  private embeddings: OpenAIEmbeddings;

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      model: 'text-embedding-3-small',
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async embedText(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(text);
  }

  async embedResource(resource: ResourceDoc): Promise<number[]> {
    return this.embedText(buildResourceText(resource));
  }
}

export class RAGPipeline {
  constructor(
    private vectorStore: VectorStore,
    private embeddingService: EmbeddingService,
  ) {}

  async indexResource(resource: ResourceDoc): Promise<void> {
    const embedding = await this.embeddingService.embedResource(resource);
    const doc: VectorDocument = {
      id: resource.id,
      content: buildResourceText(resource),
      metadata: {
        name: resource.name,
        type: resource.type,
        provider: resource.provider,
        region: resource.region ?? '',
        state: resource.state ?? '',
      },
    };
    await this.vectorStore.addDocumentsWithEmbeddings([doc], [embedding]);
  }

  async removeResource(id: string): Promise<void> {
    await this.vectorStore.deleteDocument(id);
  }

  async retrieve(query: string, topK = 10): Promise<VectorDocument[]> {
    const embedding = await this.embeddingService.embedText(query);
    return this.vectorStore.query(embedding, topK);
  }

  async assembleContext(query: string, history: ChatMessage[], topK = 10): Promise<string> {
    const resources = await this.retrieve(query, topK);

    const resourceLines = resources
      .map((r) => {
        const m = r.metadata as Record<string, string>;
        const region = m.region ? `, ${m.region}` : '';
        return `- ${m.name} (${m.type}, ${m.provider}${region}): ${m.state ?? 'unknown'}`;
      })
      .join('\n');

    const historyLines = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    return `Infrastructure context:\n${resourceLines}\n\nConversation history:\n${historyLines}`;
  }
}
