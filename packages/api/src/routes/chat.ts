/**
 * Chat endpoints for the dashboard assistant.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GraphQueryEngine, type Resource_Model } from '@cig/graph';
import { authenticate, authorize, Permission } from '../auth';
import { answerChatQuestion } from '../chat';

interface ChatRequestBody {
  message?: string;
  sessionId?: string;
}

const queryEngine = new GraphQueryEngine();

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/v1/chat',
    { preHandler: [authenticate, authorize([Permission.READ_RESOURCES])] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as ChatRequestBody | undefined;
      const message = body?.message?.trim();

      if (!message) {
        return reply.status(400).send({
          error: 'Missing required field: message',
          statusCode: 400,
        });
      }

      let resources: Resource_Model[] = [];
      try {
        resources = await queryEngine.searchResources(message);
      } catch (error) {
        request.log.warn(
          { err: error, message },
          'Chat resource search failed; using fallback response'
        );
      }

      const response = await answerChatQuestion(message, resources, body?.sessionId?.trim() || undefined);
      return reply.send(response);
    }
  );
}
