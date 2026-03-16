export interface VectorDocument {
    id: string;
    content: string;
    metadata: Record<string, unknown>;
}
export declare class VectorStore {
    private client;
    private collection;
    constructor();
    connect(): Promise<void>;
    private ensureConnected;
    addDocuments(docs: VectorDocument[]): Promise<void>;
    addDocumentsWithEmbeddings(docs: VectorDocument[], embeddings: number[][]): Promise<void>;
    query(embedding: number[], topK: number): Promise<VectorDocument[]>;
    deleteDocument(id: string): Promise<void>;
}
//# sourceMappingURL=vectordb.d.ts.map