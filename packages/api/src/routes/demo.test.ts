import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateJwt, Permission } from '../auth.js';
import { demoRoutes } from './demo.js';

const demoMocks = vi.hoisted(() => ({
  buildDemoWorkspaceGraphSnapshot: vi.fn(),
  getDemoWorkspaceStatus: vi.fn(),
  provisionDemoWorkspace: vi.fn(),
}));

vi.mock('../demo-workspace', () => ({
  buildDemoWorkspaceGraphSnapshot: demoMocks.buildDemoWorkspaceGraphSnapshot,
  getDemoWorkspaceStatus: demoMocks.getDemoWorkspaceStatus,
  provisionDemoWorkspace: demoMocks.provisionDemoWorkspace,
}));

describe('demoRoutes', () => {
  let app: ReturnType<typeof Fastify>;
  const originalAuthMode = process.env.CIG_AUTH_MODE;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(async () => {
    process.env.CIG_AUTH_MODE = 'self-hosted';
    process.env.JWT_SECRET = 'test-secret-for-demo-routes';

    app = Fastify();
    await app.register(demoRoutes);
    await app.ready();

    demoMocks.buildDemoWorkspaceGraphSnapshot.mockReset();
    demoMocks.getDemoWorkspaceStatus.mockReset();
    demoMocks.provisionDemoWorkspace.mockReset();
  });

  afterEach(async () => {
    await app.close();

    if (originalAuthMode === undefined) {
      delete process.env.CIG_AUTH_MODE;
    } else {
      process.env.CIG_AUTH_MODE = originalAuthMode;
    }

    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it('returns demo workspace status without auth in self-hosted mode', async () => {
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

  it('returns the demo graph snapshot without auth in self-hosted mode', async () => {
    demoMocks.buildDemoWorkspaceGraphSnapshot.mockResolvedValue({
      source: {
        kind: 'demo',
        available: true,
        lastSyncedAt: '2026-03-27T00:00:00.000Z',
      },
      resourceCounts: {},
      resources: [],
      relationships: [],
      discovery: {
        healthy: true,
        running: false,
        lastRun: '2026-03-27T00:00:00.000Z',
        nextRun: null,
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/demo/snapshot',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      source: {
        kind: 'demo',
        available: true,
      },
      discovery: expect.objectContaining({
        healthy: true,
        running: false,
      }),
    });
  });

  it('rejects unauthenticated demo provisioning', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/demo/provision',
      headers: {
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ force: true }),
    });

    expect(response.statusCode).toBe(401);
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

    const token = generateJwt({
      sub: 'admin-1',
      permissions: [Permission.ADMIN],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/demo/provision',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ force: true }),
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
