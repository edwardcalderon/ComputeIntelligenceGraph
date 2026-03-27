import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoRoutes } from './demo.js';

const demoMocks = vi.hoisted(() => ({
  getDemoWorkspaceStatus: vi.fn(),
  provisionDemoWorkspace: vi.fn(),
}));

vi.mock('../auth', () => ({
  authenticate: vi.fn(async (request: { user?: { sub?: string } }) => {
    request.user = { sub: 'admin-1' };
  }),
  authorize: vi.fn(() => vi.fn(async () => undefined)),
  Permission: {
    READ_RESOURCES: 'READ_RESOURCES',
    ADMIN: 'ADMIN',
  },
}));

vi.mock('../demo-workspace', () => ({
  getDemoWorkspaceStatus: demoMocks.getDemoWorkspaceStatus,
  provisionDemoWorkspace: demoMocks.provisionDemoWorkspace,
}));

describe('demoRoutes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    await app.register(demoRoutes);
    await app.ready();
    demoMocks.getDemoWorkspaceStatus.mockReset();
    demoMocks.provisionDemoWorkspace.mockReset();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns demo workspace status', async () => {
    demoMocks.getDemoWorkspaceStatus.mockResolvedValue({
      source: 'demo',
      seedVersion: '2026-03-27.1',
      seededAt: '2026-03-27T00:00:00.000Z',
      seededBy: 'system',
      resourceCount: 9,
      relationshipCount: 9,
      semanticCollection: 'infrastructure_resources__seeded',
      updatedAt: '2026-03-27T00:00:00.000Z',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/demo/status',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      source: 'demo',
      available: true,
      state: expect.objectContaining({
        resourceCount: 9,
      }),
    });
  });

  it('provisions the demo workspace for admins', async () => {
    demoMocks.provisionDemoWorkspace.mockResolvedValue({
      source: 'demo',
      seedVersion: '2026-03-27.1',
      seededAt: '2026-03-27T00:00:00.000Z',
      seededBy: 'admin-1',
      resourceCount: 9,
      relationshipCount: 9,
      semanticCollection: 'infrastructure_resources__seeded',
      updatedAt: '2026-03-27T00:00:00.000Z',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/demo/provision',
      payload: { force: true },
    });

    expect(response.statusCode).toBe(200);
    expect(demoMocks.provisionDemoWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        force: true,
        seededBy: 'admin-1',
        logger: expect.any(Object),
      })
    );
    expect(response.json()).toMatchObject({
      provisioned: true,
      state: expect.objectContaining({
        seededBy: 'admin-1',
      }),
    });
  });
});
