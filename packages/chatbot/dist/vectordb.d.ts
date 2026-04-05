export interface VectorDocument {
    id: string;
    content: string;
    metadata: Record<string, unknown>;
}
export interface ChromaConnectionConfig {
    mode: 'cloud' | 'local';
    path?: string;
    apiKey?: string;
    tenant?: string;
    database?: string;
    cloudHost?: string;
    collectionName: string;
}
export interface VectorStoreOptions {
    collectionName?: string;
}
export declare function resolveChromaConnectionConfig(collectionNameOverride?: string): ChromaConnectionConfig;
export declare class VectorStore {
    private client;
    private collection;
    private readonly collectionNameOverride?;
    constructor(options?: VectorStoreOptions);
    connect(): Promise<void>;
    private ensureConnected;
    addDocuments(docs: VectorDocument[]): Promise<void>;
    addDocumentsWithEmbeddings(docs: VectorDocument[], embeddings: number[][]): Promise<void>;
    query(embedding: number[], topK: number): Promise<VectorDocument[]>;
    deleteDocument(id: string): Promise<void>;
}
//# sourceMappingURL=vectordb.d.ts.map