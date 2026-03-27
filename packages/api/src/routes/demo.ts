import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, authorize, Permission } from '../auth';
import {
  buildDemoWorkspaceGraphSnapshot,
  getDemoWorkspaceStatus,
  provisionDemoWorkspace,
} from '../demo-workspace';

const readResources = [authenticate, authorize([Permission.READ_RESOURCES])];
const manageDemo = [authenticate, authorize([Permission.ADMIN])];

interface ProvisionDemoBody {
  force?: boolean;
}

export async function demoRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/v1/demo/status',
    { preHandler: readResources },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const state = await getDemoWorkspaceStatus();
      return reply.send({
        source: 'demo',
        available: Boolean(state && state.resourceCount > 0),
        state,
      });
    }
  );

  app.get(
    '/api/v1/demo/snapshot',
    { preHandler: readResources },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const snapshot = await buildDemoWorkspaceGraphSnapshot();
      return reply.send(snapshot);
    }
  );

  app.post(
    '/api/v1/demo/provision',
    { preHandler: manageDemo },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = (request.body as ProvisionDemoBody | undefined) ?? {};
      const user = (request as any).user as { sub?: string } | undefined;
      const seededBy = user?.sub ?? 'admin';

      try {
        const state = await provisionDemoWorkspace({
          force: Boolean(body.force),
          seededBy,
          logger: request.log,
        });

        return reply.send({
          provisioned: true,
          state,
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to provision demo workspace');
        return reply.status(500).send({
          error: error instanceof Error ? error.message : 'Failed to provision demo workspace',
          statusCode: 500,
        });
      }
    }
  );
}
