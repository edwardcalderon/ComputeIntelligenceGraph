import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, authorize, Permission } from '../auth';
import { getAuthMode } from '../bootstrap/state';
import {
  buildDemoWorkspaceGraphSnapshot,
  getDemoWorkspaceStatus,
  provisionDemoWorkspace,
} from '../demo-workspace';

const readResources = [authenticate, authorize([Permission.READ_RESOURCES])];
const manageDemo = [authenticate, authorize([Permission.ADMIN])];

function resolveDemoReadOptions() {
  return getAuthMode() === 'self-hosted' ? {} : { preHandler: readResources };
}

interface ProvisionDemoBody {
  force?: boolean;
}

export async function demoRoutes(app: FastifyInstance): Promise<void> {
  const demoReadOptions = resolveDemoReadOptions();

  app.get(
    '/api/v1/demo/status',
    demoReadOptions,
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
    demoReadOptions,
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
