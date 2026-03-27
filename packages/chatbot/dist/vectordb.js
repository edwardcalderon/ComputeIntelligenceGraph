"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorStore = void 0;
exports.resolveChromaConnectionConfig = resolveChromaConnectionConfig;
const chromadb_1 = require("chromadb");
const DEFAULT_COLLECTION_NAME = 'infrastructure_resources';
// Singleton client instance (connection pooling via reuse)
let clientInstance = null;
const collectionCache = new Map();
function normalizeCloudHost(host) {
    const trimmed = host.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }
    return `https://${trimmed}`;
}
function resolveChromaConnectionConfig() {
    const cloudApiKey = process.env.CHROMA_API_KEY?.trim();
    const cloudTenant = process.env.CHROMA_TENANT?.trim();
    const cloudDatabase = process.env.CHROMA_DATABASE?.trim();
    const cloudHost = process.env.CHROMA_HOST?.trim();
    const collectionName = process.env.CHROMA_COLLECTION?.trim() || DEFAULT_COLLECTION_NAME;
    if (cloudApiKey) {
        if (!cloudTenant || !cloudDatabase) {
            throw new Error('CHROMA_TENANT and CHROMA_DATABASE are required when CHROMA_API_KEY is set.');
        }
        return {
            mode: 'cloud',
            apiKey: cloudApiKey,
            tenant: cloudTenant,
            database: cloudDatabase,
            cloudHost: normalizeCloudHost(cloudHost || 'api.trychroma.com'),
            collectionName,
        };
    }
    const url = process.env.CHROMA_URL ?? 'http://localhost:8000';
    return {
        mode: 'local',
        path: url,
        collectionName,
    };
}
function createClient() {
    const config = resolveChromaConnectionConfig();
    if (config.mode === 'cloud') {
        return new chromadb_1.CloudClient({
            apiKey: config.apiKey,
            tenant: config.tenant,
            database: config.database,
            cloudHost: config.cloudHost,
        });
    }
    return new chromadb_1.ChromaClient({ path: config.path });
}
class VectorStore {
    client;
    collection = null;
    constructor() {
        if (!clientInstance) {
            clientInstance = createClient();
        }
        this.client = clientInstance;
    }
    async connect() {
        const { collectionName } = resolveChromaConnectionConfig();
        const cachedCollection = collectionCache.get(collectionName);
        if (cachedCollection) {
            this.collection = cachedCollection;
            return;
        }
        this.collection = await this.client.getOrCreateCollection({ name: collectionName });
        collectionCache.set(collectionName, this.collection);
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