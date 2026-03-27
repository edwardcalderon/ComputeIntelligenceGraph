/**
 * Chat endpoints for the dashboard assistant.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GraphEngine, GraphQueryEngine, type GraphScope, type Resource_Model } from '@cig/graph';
import { CartographyClient } from '@cig/discovery';
import { authenticate, authorize, Permission } from '../auth';
import { DEMO_GRAPH_SCOPE, resolveGraphScope } from '../graph-scope';
import { answerChatQuestion, type ChatInfrastructureSnapshot } from '../chat';
import {
  buildAttachmentContextItem,
  readMultipartFile,
  transcribeAudioFile,
} from '../chat-inputs';
import { buildDemoWorkspaceGraphSnapshot } from '../demo-workspace';
import {
  appendChatExchange,
  deleteChatSession,
  ensureChatSession,
  getChatHistory,
  getChatSessionMessages,
  listChatSessions,
  renameChatSession,
} from '../chat-store';
import {
  deriveChatSeedFromContextItems,
  deriveImplicitQuestionFromContextItems,
  normalizeChatContextItems,
  type ChatContextItem,
  type ChatTranscriptContextItem,
} from '../chat-context';

interface ChatRequestBody {
  message?: string;
  sessionId?: string;
  contextItems?: unknown[];
  graphSource?: string;
}

interface RenameSessionBody {
  title?: string;
}

function buildAssistantMessageContent(response: {
  answer: string;
  needsClarification: boolean;
  clarifyingQuestion?: string;
}): string {
  const answer = response.answer?.trim();
  const clarifyingQuestion = response.clarifyingQuestion?.trim();

  if (response.needsClarification && clarifyingQuestion) {
    if (!answer || answer === clarifyingQuestion) {
      return clarifyingQuestion;
    }

    return `${answer}\n\n${clarifyingQuestion}`;
  }

  return answer || clarifyingQuestion || '';
}

const queryEngine = new GraphQueryEngine();
const graphEngine = new GraphEngine();
const cartographyClient = new CartographyClient();
const DEFAULT_DISCOVERY_INTERVAL_MINUTES = 5;

function resolveDeploymentMode(): ChatInfrastructureSnapshot['deploymentMode'] {
  return process.env['CIG_AUTH_MODE'] === 'managed' ? 'managed' : 'self-hosted';
}

function normalizeGraphSource(value: unknown): 'live' | 'demo' {
  return value === 'demo' ? 'demo' : 'live';
}

function resolveDiscoveryIntervalMinutes(): number {
  const parsed = Number.parseInt(process.env.DISCOVERY_INTERVAL_MINUTES ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DISCOVERY_INTERVAL_MINUTES;
}

function resolveNextRun(lastRun: string | null): string | null {
  if (!lastRun) {
    return null;
  }

  const startedAt = new Date(lastRun);
  if (Number.isNaN(startedAt.getTime())) {
    return null;
  }

  startedAt.setMinutes(startedAt.getMinutes() + resolveDiscoveryIntervalMinutes());
  return startedAt.toISOString();
}

function demoResourceToModel(
  resource: {
    id: string;
    name: string;
    type: string;
    provider: string;
    region?: string | null;
    state?: string | null;
    tags?: Record<string, string>;
  },
): Resource_Model {
  const now = new Date();
  return {
    id: resource.id,
    name: resource.name,
    type: resource.type as Resource_Model['type'],
    provider: resource.provider as Resource_Model['provider'],
    region: resource.region ?? undefined,
    zone: undefined,
    state: (resource.state ?? 'active') as Resource_Model['state'],
    tags: resource.tags ?? {},
    metadata: {},
    cost: undefined,
    ownerId: undefined,
    tenant: undefined,
    workspace: undefined,
    createdAt: now,
    updatedAt: now,
    discoveredAt: now,
  };
}

async function buildInfrastructureSnapshot(
  source: 'live' | 'demo',
  scope?: GraphScope
): Promise<ChatInfrastructureSnapshot> {
  if (source === 'demo') {
    const demoSnapshot = await buildDemoWorkspaceGraphSnapshot().catch(() => null);
    if (demoSnapshot) {
      return {
        resourceCounts: demoSnapshot.resourceCounts,
        sampleResources: demoSnapshot.resources.slice(0, 3).map(demoResourceToModel),
        discoveryHealthy: demoSnapshot.source.available,
        discoveryRunning: demoSnapshot.discovery.running,
        discoveryLastRun: demoSnapshot.discovery.lastRun,
        discoveryNextRun: demoSnapshot.discovery.nextRun,
        deploymentMode: resolveDeploymentMode(),
      };
    }
  }

  const [resourceCountsResult, sampleResourcesResult, healthResult, statusResult] = await Promise.allSettled([
    queryEngine.getResourceCounts(scope),
    queryEngine.listResourcesPaged(undefined, { limit: 3 }, scope),
    cartographyClient.healthCheck(),
    cartographyClient.getStatus(),
  ]);

  const resourceCounts =
    resourceCountsResult.status === 'fulfilled' ? resourceCountsResult.value : {};
  const sampleResources =
    sampleResourcesResult.status === 'fulfilled' ? sampleResourcesResult.value.items.slice(0, 3) : [];
  const discoveryHealthy = healthResult.status === 'fulfilled' ? healthResult.value : false;
  const discoveryStatus = statusResult.status === 'fulfilled' ? statusResult.value : null;
  const discoveryLastRun =
    discoveryStatus?.last_run_end ?? discoveryStatus?.last_run_start ?? null;

  return {
    resourceCounts,
    sampleResources,
    discoveryHealthy,
    discoveryRunning: discoveryStatus?.running ?? false,
    discoveryLastRun,
    discoveryNextRun: resolveNextRun(discoveryLastRun),
    deploymentMode: resolveDeploymentMode(),
  };
}

function buildChatErrorPayload(error: unknown) {
  return {
    error: error instanceof Error ? error.message : 'Chat input request failed',
    statusCode: 400,
  };
}

function dedupeResources(resources: Resource_Model[]): Resource_Model[] {
  const next = new Map<string, Resource_Model>();

  for (const resource of resources) {
    next.set(resource.id, resource);
  }

  return [...next.values()];
}

async function resolveLinkedResources(
  contextItems: ChatContextItem[],
  scope?: GraphScope
): Promise<Resource_Model[]> {
  const linkedResourceIds = contextItems
    .filter((item): item is Extract<ChatContextItem, { type: 'resource_link' }> => item.type === 'resource_link')
    .map((item) => item.resourceId);

  if (linkedResourceIds.length === 0) {
    return [];
  }

  const results = await Promise.all(
    linkedResourceIds.map(async (resourceId) => {
      try {
        return await graphEngine.getResource(resourceId, scope);
      } catch {
        return null;
      }
    })
  );

  return results.filter((resource): resource is Resource_Model => resource !== null);
}

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/v1/chat/uploads',
    { preHandler: [authenticate, authorize([Permission.READ_RESOURCES])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const filePart = await request.file();
        if (!filePart) {
          return reply.status(400).send({
            error: 'Missing uploaded file.',
            statusCode: 400,
          });
        }

        const file = await readMultipartFile(filePart);
        const item = await buildAttachmentContextItem(file);
        return reply.send({ item });
      } catch (error) {
        return reply.status(400).send(buildChatErrorPayload(error));
      }
    }
  );

  app.post(
    '/api/v1/chat/transcriptions',
    { preHandler: [authenticate, authorize([Permission.READ_RESOURCES])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const filePart = await request.file();
        if (!filePart) {
          return reply.status(400).send({
            error: 'Missing audio file.',
            statusCode: 400,
          });
        }

        const fields = (filePart as typeof filePart & {
          fields?: Record<string, { value?: string }>;
        }).fields;
        const durationMs = Number(fields?.['durationMs']?.value ?? '0');
        const mode =
          fields?.['mode']?.value === 'auto-send'
            ? 'auto-send'
            : ('review' satisfies ChatTranscriptContextItem['mode']);

        const file = await readMultipartFile(filePart);
        const result = await transcribeAudioFile({
          file,
          durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0,
          mode,
        });
        return reply.send(result);
      } catch (error) {
        return reply.status(400).send(buildChatErrorPayload(error));
      }
    }
  );

  app.get(
    '/api/v1/chat/sessions',
    { preHandler: [authenticate, authorize([Permission.READ_RESOURCES])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';
      const sessions = await listChatSessions(userId);
      return reply.send({ items: sessions, total: sessions.length });
    }
  );

  app.get(
    '/api/v1/chat/sessions/:id/messages',
    { preHandler: [authenticate, authorize([Permission.READ_RESOURCES])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';
      const sessions = await listChatSessions(userId);
      const session = sessions.find((item) => item.id === id);

      if (!session) {
        return reply.status(404).send({
          error: 'Chat session not found',
          statusCode: 404,
        });
      }

      const messages = await getChatSessionMessages(userId, id);
      return reply.send({ session, items: messages, total: messages.length });
    }
  );

  app.delete(
    '/api/v1/chat/sessions/:id',
    { preHandler: [authenticate, authorize([Permission.READ_RESOURCES])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';
      const deleted = await deleteChatSession(userId, id);

      if (!deleted) {
        return reply.status(404).send({
          error: 'Chat session not found',
          statusCode: 404,
        });
      }

      return reply.send({ success: true });
    }
  );

  app.patch(
    '/api/v1/chat/sessions/:id',
    { preHandler: [authenticate, authorize([Permission.READ_RESOURCES])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { title } = (request.body as RenameSessionBody | undefined) ?? {};
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';

      if (!title?.trim()) {
        return reply.status(400).send({
          error: 'Missing required field: title',
          statusCode: 400,
        });
      }

      try {
        const updated = await renameChatSession(userId, id, title);

        if (!updated) {
          return reply.status(404).send({
            error: 'Chat session not found',
            statusCode: 404,
          });
        }

        return reply.send(updated);
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : 'Failed to rename chat session',
          statusCode: 400,
        });
      }
    }
  );

  app.post(
    '/api/v1/chat',
    { preHandler: [authenticate, authorize([Permission.READ_RESOURCES])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as ChatRequestBody | undefined;
      const message = body?.message?.trim() ?? '';
      const contextItems = normalizeChatContextItems(body?.contextItems);
      const graphSource = normalizeGraphSource(body?.graphSource);
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';
      const graphScope = graphSource === 'demo' ? DEMO_GRAPH_SCOPE : resolveGraphScope(user);

      if (!message && contextItems.length === 0) {
        return reply.status(400).send({
          error: 'Missing required field: message or contextItems',
          statusCode: 400,
        });
      }

      const sessionSeed = message || deriveChatSeedFromContextItems(contextItems) || '';
      const session = await ensureChatSession(userId, body?.sessionId?.trim() || undefined, sessionSeed);
      const history = await getChatHistory(userId, session.id);
      const effectiveQuestion = message || deriveImplicitQuestionFromContextItems(contextItems);

      const [linkedResources, searchedResources] = await Promise.all([
        resolveLinkedResources(contextItems, graphScope),
        message
          ? queryEngine.searchResources(message, graphScope).catch((error) => {
              request.log.warn(
                { err: error, message },
                'Chat resource search failed; using fallback response'
              );
              return [] as Resource_Model[];
            })
          : Promise.resolve([] as Resource_Model[]),
      ]);
      const resources = dedupeResources([...linkedResources, ...searchedResources]);

      let infrastructure: ChatInfrastructureSnapshot | undefined;
      if (resources.length === 0) {
        try {
          infrastructure = await buildInfrastructureSnapshot(graphSource, graphScope);
        } catch (error) {
          request.log.warn(
            { err: error, message: effectiveQuestion },
            'Infrastructure snapshot unavailable; using chat fallback without snapshot'
          );
        }
      }

      const response = await answerChatQuestion(
        effectiveQuestion,
        resources,
        history,
        contextItems,
        infrastructure
      );
      const assistantContent = buildAssistantMessageContent(response);

      const updatedSession = await appendChatExchange(userId, session.id, message, assistantContent, {
        userContextItems: contextItems,
      });
      return reply.send({ ...response, sessionId: updatedSession.id });
    }
  );
}
