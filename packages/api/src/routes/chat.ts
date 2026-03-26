/**
 * Chat endpoints for the dashboard assistant.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GraphQueryEngine, type Resource_Model } from '@cig/graph';
import { authenticate, authorize, Permission } from '../auth';
import { answerChatQuestion } from '../chat';
import {
  appendChatExchange,
  deleteChatSession,
  ensureChatSession,
  getChatHistory,
  getChatSessionMessages,
  listChatSessions,
} from '../chat-store';

interface ChatRequestBody {
  message?: string;
  sessionId?: string;
}

const queryEngine = new GraphQueryEngine();

export async function chatRoutes(app: FastifyInstance): Promise<void> {
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

  app.post(
    '/api/v1/chat',
    { preHandler: [authenticate, authorize([Permission.READ_RESOURCES])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as ChatRequestBody | undefined;
      const message = body?.message?.trim();
      const user = (request as any).user as { sub: string } | undefined;
      const userId = user?.sub ?? 'unknown';

      if (!message) {
        return reply.status(400).send({
          error: 'Missing required field: message',
          statusCode: 400,
        });
      }

      const session = await ensureChatSession(userId, body?.sessionId?.trim() || undefined, message);
      const history = await getChatHistory(userId, session.id);

      let resources: Resource_Model[] = [];
      try {
        resources = await queryEngine.searchResources(message);
      } catch (error) {
        request.log.warn(
          { err: error, message },
          'Chat resource search failed; using fallback response'
        );
      }

      const response = await answerChatQuestion(message, resources, history);
      const assistantContent =
        response.needsClarification && response.clarifyingQuestion
          ? response.clarifyingQuestion
          : response.answer;

      const updatedSession = await appendChatExchange(userId, session.id, message, assistantContent);
      return reply.send({ ...response, sessionId: updatedSession.id });
    }
  );
}
