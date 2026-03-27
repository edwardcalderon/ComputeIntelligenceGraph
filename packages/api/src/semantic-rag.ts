import crypto from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import { GraphEngine, GraphQueryEngine, type Resource_Model, type GraphScope } from '@cig/graph';
import type { GraphDelta } from '@cig/sdk';
import { EmbeddingService, RAGPipeline, VectorStore, type ResourceDoc } from '@cig/chatbot';

type SemanticLogger = Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>;

export interface SemanticScope {
  deploymentMode: 'managed' | 'self-hosted';
  tenant?: string | null;
  userId?: string | null;
}

const DEFAULT_COLLECTION_NAME = 'infrastructure_resources';

const graphEngine = new GraphEngine();
const graphQueryEngine = new GraphQueryEngine();
const pipelinePromises = new Map<string, Promise<RAGPipeline | null>>();
const observedScopes = new Map<string, SemanticScope>();
const initializedCollections = new Set<string>();

function hasOpenAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    ),
  ];
}

function normalizeOptionalText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function resolveGraphScope(scope?: SemanticScope): GraphScope | undefined {
  if (!scope || scope.deploymentMode !== 'managed') {
    return undefined;
  }

  const ownerId = normalizeOptionalText(scope.userId);
  const tenant = normalizeOptionalText(scope.tenant);
  if (!ownerId && !tenant) {
    return undefined;
  }

  return {
    ownerId: ownerId || undefined,
    tenant: tenant || undefined,
    workspace: tenant || undefined,
  };
}

function resourceToDoc(resource: Resource_Model, relationships: string[] = []): ResourceDoc {
  return {
    id: resource.id,
    name: resource.name,
    type: String(resource.type),
    provider: String(resource.provider),
    region: resource.region,
    state: String(resource.state),
    tags: resource.tags,
    relationships,
  };
}

async function hydrateResourceDoc(resourceId: string, scope?: SemanticScope): Promise<ResourceDoc | null> {
  const resource = await graphEngine.getResource(resourceId, resolveGraphScope(scope));
  if (!resource) {
    return null;
  }

  let relationships: string[] = [];
  try {
    const rels = await graphEngine.getRelationships(resourceId, resolveGraphScope(scope));
    relationships = rels.map((rel) => `${rel.type}:${rel.fromId}->${rel.toId}`);
  } catch {
    relationships = [];
  }

  return resourceToDoc(resource, relationships);
}

function resolveBaseCollectionName(): string {
  return process.env.CHROMA_COLLECTION?.trim() || DEFAULT_COLLECTION_NAME;
}

function resolveSemanticCollectionName(scope?: SemanticScope): string {
  const baseCollection = resolveBaseCollectionName();

  if (!scope || scope.deploymentMode !== 'managed') {
    return baseCollection;
  }

  const namespaceParts = [
    normalizeOptionalText(scope.tenant),
    normalizeOptionalText(scope.userId),
  ].filter(Boolean);

  if (namespaceParts.length === 0) {
    return baseCollection;
  }

  const namespaceHash = crypto
    .createHash('sha256')
    .update(namespaceParts.join('::'))
    .digest('hex')
    .slice(0, 24);

  return `${baseCollection}__${namespaceHash}`;
}

function rememberSemanticScope(collectionName: string, scope?: SemanticScope): void {
  if (!scope || scope.deploymentMode !== 'managed') {
    return;
  }

  observedScopes.set(collectionName, {
    deploymentMode: scope.deploymentMode,
    tenant: normalizeOptionalText(scope.tenant) || undefined,
    userId: normalizeOptionalText(scope.userId) || undefined,
  });
}

async function getPipeline(scope?: SemanticScope, logger?: SemanticLogger): Promise<RAGPipeline | null> {
  if (!hasOpenAiKey()) {
    return null;
  }

  const collectionName = resolveSemanticCollectionName(scope);
  rememberSemanticScope(collectionName, scope);

  if (!pipelinePromises.has(collectionName)) {
    pipelinePromises.set(
      collectionName,
      (async () => {
        try {
          const store = new VectorStore({ collectionName });
          await store.connect();
          return new RAGPipeline(store, new EmbeddingService());
        } catch (error) {
          logger?.warn?.(
            { err: error, collectionName },
            'Semantic RAG pipeline unavailable; skipping vector operations'
          );
          return null;
        }
      })().catch((error) => {
        logger?.warn?.(
          { err: error, collectionName },
          'Semantic RAG pipeline initialization failed; skipping vector operations'
        );
        return null;
      })
    );
  }

  return pipelinePromises.get(collectionName) ?? null;
}

async function syncSemanticIndexOnPipeline(
  pipeline: RAGPipeline,
  logger?: SemanticLogger,
  scope?: SemanticScope,
  pageSize = 250
): Promise<{ indexed: number }> {
  let indexed = 0;
  let offset = 0;

  while (true) {
    const page = await graphQueryEngine.listResourcesPaged(
      undefined,
      { limit: pageSize, offset },
      resolveGraphScope(scope)
    );
    if (page.items.length === 0) {
      break;
    }

    const documents = page.items.map((resource) => resourceToDoc(resource));
    await pipeline.indexResources(documents);
    indexed += documents.length;

    if (!page.hasMore) {
      break;
    }

    offset += page.items.length;
  }

  if (scope?.deploymentMode === 'managed') {
    const collectionName = resolveSemanticCollectionName(scope);
    initializedCollections.add(collectionName);
  }

  logger?.info?.(
    {
      indexed,
      collectionName: scope ? resolveSemanticCollectionName(scope) : resolveBaseCollectionName(),
      managed: scope?.deploymentMode === 'managed',
    },
    'Semantic graph index sync completed'
  );

  return { indexed };
}

export async function indexGraphDeltaResources(
  delta: Pick<GraphDelta, 'additions' | 'modifications' | 'deletions'>,
  scope?: SemanticScope,
  logger?: SemanticLogger
): Promise<void> {
  const pipeline = await getPipeline(scope, logger);
  if (!pipeline) {
    return;
  }

  const resourceIds = uniqueStrings([
    ...(delta.additions ?? []).map((node) => node.id),
    ...(delta.modifications ?? []).map((node) => node.id),
  ]);

  if (resourceIds.length > 0) {
    const documents = (
      await Promise.all(resourceIds.map(async (resourceId) => hydrateResourceDoc(resourceId, scope)))
    ).filter((doc): doc is ResourceDoc => doc !== null);

    if (documents.length > 0) {
      await pipeline.indexResources(documents);
    }
  }

  const deletedIds = uniqueStrings(delta.deletions ?? []);
  for (const resourceId of deletedIds) {
    await pipeline.removeResource(resourceId);
  }
}

export async function syncSemanticIndex(
  scope?: SemanticScope,
  logger?: SemanticLogger,
  pageSize = 250
): Promise<{ indexed: number }> {
  const pipeline = await getPipeline(scope, logger);
  if (!pipeline) {
    return { indexed: 0 };
  }

  return syncSemanticIndexOnPipeline(pipeline, logger, scope, pageSize);
}

export function listObservedSemanticScopes(): SemanticScope[] {
  return [...observedScopes.values()];
}

export function resetSemanticRagCache(): void {
  pipelinePromises.clear();
  observedScopes.clear();
  initializedCollections.clear();
}

export async function retrieveSemanticResources(
  query: string,
  topK = 5,
  scope?: SemanticScope,
  logger?: SemanticLogger
): Promise<Resource_Model[]> {
  const pipeline = await getPipeline(scope, logger);
  if (!pipeline) {
    return [];
  }

  try {
    const collectionName = resolveSemanticCollectionName(scope);
    if (scope?.deploymentMode === 'managed' && !initializedCollections.has(collectionName)) {
      try {
        await syncSemanticIndexOnPipeline(pipeline, logger, scope);
      } catch (error) {
        logger?.warn?.(
          { err: error, query, collectionName },
          'Semantic backfill failed; continuing with existing vector state'
        );
      }
    }

    const docs = await pipeline.retrieve(query, topK);
    const resourceIds = uniqueStrings(docs.map((doc) => doc.id));
    if (resourceIds.length === 0) {
      return [];
    }

    const resources = await Promise.all(
      resourceIds.map(async (resourceId) => {
        try {
          return await graphEngine.getResource(resourceId, resolveGraphScope(scope));
        } catch {
          return null;
        }
      })
    );

    return resources.filter((resource): resource is Resource_Model => resource !== null);
  } catch (error) {
    logger?.warn?.({ err: error, query }, 'Semantic retrieval failed; continuing without vector matches');
    return [];
  }
}
