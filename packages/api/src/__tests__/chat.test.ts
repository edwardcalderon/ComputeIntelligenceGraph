import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { GraphQueryEngine, Provider, ResourceState, ResourceType, type Resource_Model } from '@cig/graph';
import { createServer } from '../index';
import { clearChatSessions } from '../chat';
import { generateJwt, Permission } from '../auth';

function makeAuthHeader(): string {
  const token = generateJwt({
    sub: 'chat-test-user',
    permissions: [Permission.READ_RESOURCES],
  });
  return `Bearer ${token}`;
}

function makeResource(): Resource_Model {
  const now = new Date();
  return {
    id: 'svc-prod-api',
    name: 'prod-api',
    type: ResourceType.SERVICE,
    provider: Provider.AWS,
    region: 'us-east-1',
    zone: undefined,
    state: ResourceState.RUNNING,
    tags: { env: 'prod' },
    metadata: { owner: 'platform' },
    cost: 42,
    createdAt: now,
    updatedAt: now,
    discoveredAt: now,
  };
}

describe('POST /api/v1/chat', () => {
  let app: FastifyInstance;
  const searchResourcesSpy = vi.spyOn(GraphQueryEngine.prototype, 'searchResources');

  beforeAll(async () => {
    process.env['DATABASE_URL'] = 'sqlite://:memory:';
    process.env['JWT_SECRET'] = 'test-secret-for-chat-tests-at-least-32-chars!!';
    process.env['OPENAI_API_KEY'] = '';

    app = await createServer();
    await app.ready();
  });

  afterAll(async () => {
    searchResourcesSpy.mockRestore();
    await app.close();
  });

  beforeEach(() => {
    clearChatSessions();
    searchResourcesSpy.mockReset();
  });

  it('summarizes matching resources for authenticated users', async () => {
    searchResourcesSpy.mockResolvedValueOnce([makeResource()]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      headers: {
        authorization: makeAuthHeader(),
      },
      payload: {
        message: 'show me the production api',
        sessionId: 'chat-session-1',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ answer: string; needsClarification: boolean }>();
    expect(body.answer).toContain('prod-api');
    expect(body.needsClarification).toBe(false);
  });

  it('asks for clarification when nothing matches', async () => {
    searchResourcesSpy.mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      headers: {
        authorization: makeAuthHeader(),
      },
      payload: {
        message: 'tell me about the thing',
        sessionId: 'chat-session-2',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ needsClarification: boolean; clarifyingQuestion?: string }>();
    expect(body.needsClarification).toBe(true);
    expect(body.clarifyingQuestion).toContain('provider');
  });
});
