"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorStore = void 0;
const chromadb_1 = require("chromadb");
const COLLECTION_NAME = 'infrastructure_resources';
// Singleton client instance (connection pooling via reuse)
let clientInstance = null;
let collectionInstance = null;
class VectorStore {
    client;
    collection = null;
    constructor() {
        if (!clientInstance) {
            const url = process.env.CHROMA_URL ?? 'http://localhost:8000';
            clientInstance = new chromadb_1.ChromaClient({ path: url });
        }
        this.client = clientInstance;
    }
    async connect() {
        if (collectionInstance) {
            this.collection = collectionInstance;
            return;
        }
        this.collection = await this.client.getOrCreateCollection({
            name: COLLECTION_NAME,
        });
        collectionInstance = this.collection;
    }
    ensureConnected() {
        if (!this.collection) {
            throw new Error('VectorStore not connected. Call connect() first.');
        }
        return this.collection;
    }
    async addDocuments(docs) {
        const col = this.ensureConnected();
        await col.upsert({
            ids: docs.map((d) => d.id),
            documents: docs.map((d) => d.content),
            metadatas: docs.map((d) => d.metadata),
        });
    }
    async addDocumentsWithEmbeddings(docs, embeddings) {
        const col = this.ensureConnected();
        await col.upsert({
            ids: docs.map((d) => d.id),
            documents: docs.map((d) => d.content),
            metadatas: docs.map((d) => d.metadata),
            embeddings,
        });
    }
    async query(embedding, topK) {
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
            metadata: metadatas[i] ?? {},
        }));
    }
    async deleteDocument(id) {
        const col = this.ensureConnected();
        await col.delete({ ids: [id] });
    }
}
exports.VectorStore = VectorStore;
//# sourceMappingURL=vectordb.js.map