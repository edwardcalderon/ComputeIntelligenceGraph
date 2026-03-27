import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nodeGraphDeltaRoutes } from './graphDelta.js';

const routeMocks = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
  applyDelta: vi.fn().mockResolvedValue(undefined),
  indexGraphDeltaResources: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../db/client', () => ({
  query: routeMocks.query,
}));

vi.mock('../../middleware/auth', () => ({
  requireNodeAuth: vi.fn(async (request: { nodeId?: string; params?: { id?: string } }) => {
    request.nodeId = request.params?.id ?? 'node-1';
  }),
}));

vi.mock('../../semantic-rag', () => ({
  indexGraphDeltaResources: routeMocks.indexGraphDeltaResources,
}));

vi.mock('@cig/graph', () => ({
  applyDelta: routeMocks.applyDelta,
  getDriver: vi.fn().mockReturnValue({}),
  GraphEngine: vi.fn().mockImplementation(() => ({
    updateResource: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('nodeGraphDeltaRoutes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    await app.register(nodeGraphDeltaRoutes);
    await app.ready();
    routeMocks.query.mockClear();
    routeMocks.applyDelta.mockClear();
    routeMocks.indexGraphDeltaResources.mockClear();
  });

  afterEach(async () => {
    await app.close();
  });

  it('indexes additions and modifications after a delta is applied', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/nodes/node-1/graph-delta',
      payload: {
        nodeId: 'node-1',
        deltaType: 'targeted',
        timestamp: '2026-03-27T00:00:00.000Z',
        scanId: 'scan-123',
        additions: [
          {
            id: 'res-1',
            type: 'service',
            provider: 'aws',
            properties: {},
          },
        ],
        modifications: [
          {
            id: 'res-2',
            properties: { state: 'running' },
          },
        ],
        deletions: ['res-3'],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(routeMocks.applyDelta).toHaveBeenCalledTimes(1);
    expect(routeMocks.indexGraphDeltaResources).toHaveBeenCalledTimes(1);
    expect(routeMocks.indexGraphDeltaResources).toHaveBeenCalledWith(
      expect.objectContaining({
        additions: expect.arrayContaining([expect.objectContaining({ id: 'res-1' })]),
        modifications: expect.arrayContaining([expect.objectContaining({ id: 'res-2' })]),
        deletions: ['res-3'],
      }),
      undefined,
      expect.anything()
    );
  });
});
