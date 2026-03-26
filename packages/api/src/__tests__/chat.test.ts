import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { GraphQueryEngine, Provider, ResourceState, ResourceType, type Resource_Model } from '@cig/graph';
import { createServer } from '../index';
import { clearPersistedChatSessionsForTests } from '../chat-store';
import { generateJwt, Permission } from '../auth';
import { answerChatQuestion } from '../chat';

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
    await clearPersistedChatSessionsForTests();
  });

  afterAll(async () => {
    searchResourcesSpy.mockRestore();
    await app.close();
  });

  beforeEach(async () => {
    searchResourcesSpy.mockReset();
    await clearPersistedChatSessionsForTests();
  });

  it('creates and persists a session when a user sends the first message', async () => {
    searchResourcesSpy.mockResolvedValueOnce([makeResource()]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      headers: {
        authorization: makeAuthHeader(),
      },
      payload: {
        message: 'show me the production api',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ sessionId?: string; answer: string; needsClarification: boolean }>();
    expect(body.sessionId).toBeTypeOf('string');
    expect(body.answer).toContain('prod-api');
    expect(body.needsClarification).toBe(false);

    const sessionsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/chat/sessions',
      headers: {
        authorization: makeAuthHeader(),
      },
    });

    expect(sessionsResponse.statusCode).toBe(200);
    const sessions = sessionsResponse.json<{
      items: Array<{ id: string; title: string; lastMessagePreview: string | null }>;
      total: number;
    }>();
    expect(sessions.total).toBe(1);
    expect(sessions.items[0]?.id).toBe(body.sessionId);
    expect(sessions.items[0]?.title).toContain('show me the production api');
    expect(sessions.items[0]?.lastMessagePreview).toContain('I found');

    const messagesResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/chat/sessions/${body.sessionId}/messages`,
      headers: {
        authorization: makeAuthHeader(),
      },
    });

    expect(messagesResponse.statusCode).toBe(200);
    const messages = messagesResponse.json<{
      items: Array<{ role: 'user' | 'assistant'; content: string }>;
      total: number;
    }>();
    expect(messages.total).toBe(2);
    expect(messages.items.map((item) => item.role)).toEqual(['user', 'assistant']);
  });

  it('reuses an existing session id and appends later exchanges', async () => {
    searchResourcesSpy.mockResolvedValue([makeResource()]);

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      headers: {
        authorization: makeAuthHeader(),
      },
      payload: {
        message: 'show me the production api',
      },
    });

    const sessionId = first.json<{ sessionId: string }>().sessionId;

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      headers: {
        authorization: makeAuthHeader(),
      },
      payload: {
        message: 'expand prod-api',
        sessionId,
      },
    });

    expect(second.statusCode).toBe(200);
    expect(second.json<{ sessionId?: string }>().sessionId).toBe(sessionId);

    const messagesResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/chat/sessions/${sessionId}/messages`,
      headers: {
        authorization: makeAuthHeader(),
      },
    });

    const messages = messagesResponse.json<{
      items: Array<{ role: 'user' | 'assistant'; content: string }>;
      total: number;
    }>();

    expect(messages.total).toBe(4);
    expect(messages.items[2]?.content).toBe('expand prod-api');
  });

  it('renames a stored session', async () => {
    searchResourcesSpy.mockResolvedValueOnce([makeResource()]);

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      headers: {
        authorization: makeAuthHeader(),
      },
      payload: {
        message: 'show me the production api',
      },
    });

    const sessionId = created.json<{ sessionId: string }>().sessionId;

    const renameResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/chat/sessions/${sessionId}`,
      headers: {
        authorization: makeAuthHeader(),
      },
      payload: {
        title: 'Production alerts',
      },
    });

    expect(renameResponse.statusCode).toBe(200);
    expect(renameResponse.json<{ title: string }>().title).toBe('Production alerts');

    const sessionsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/chat/sessions',
      headers: {
        authorization: makeAuthHeader(),
      },
    });

    const sessions = sessionsResponse.json<{
      items: Array<{ id: string; title: string }>;
      total: number;
    }>();

    expect(sessions.total).toBe(1);
    expect(sessions.items[0]?.id).toBe(sessionId);
    expect(sessions.items[0]?.title).toBe('Production alerts');
  });

  it('asks for clarification and allows a stored session to be deleted', async () => {
    searchResourcesSpy.mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      headers: {
        authorization: makeAuthHeader(),
      },
      payload: {
        message: 'tell me about the thing',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      sessionId?: string;
      answer: string;
      needsClarification: boolean;
      clarifyingQuestion?: string;
    }>();
    expect(body.needsClarification).toBe(true);
    expect(body.clarifyingQuestion).toContain('provider');
    expect(body.answer).toContain('I could not match');

    const messagesResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/chat/sessions/${body.sessionId}/messages`,
      headers: {
        authorization: makeAuthHeader(),
      },
    });

    expect(messagesResponse.statusCode).toBe(200);
    const messages = messagesResponse.json<{
      items: Array<{ role: 'user' | 'assistant'; content: string }>;
    }>();
    expect(messages.items[1]?.content).toContain('I could not match');
    expect(messages.items[1]?.content).toContain('provider');

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/v1/chat/sessions/${body.sessionId}`,
      headers: {
        authorization: makeAuthHeader(),
      },
    });

    expect(deleteResponse.statusCode).toBe(200);

    const sessionsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/chat/sessions',
      headers: {
        authorization: makeAuthHeader(),
      },
    });

    expect(sessionsResponse.json<{ total: number }>().total).toBe(0);
  });
});

describe('answerChatQuestion', () => {
  beforeEach(() => {
    process.env['OPENAI_API_KEY'] = '';
  });

  it('returns a conversational reply for general questions without infrastructure context', async () => {
    const response = await answerChatQuestion('what are you?', []);

    expect(response.needsClarification).toBe(false);
    expect(response.answer.toLowerCase()).toContain('cig assistant');
  });

  it('uses a domain-specific clarification for cost questions without matches', async () => {
    const response = await answerChatQuestion('show me the cost of my databases', []);

    expect(response.needsClarification).toBe(true);
    expect(response.answer.toLowerCase()).toContain('could not match');
    expect(response.clarifyingQuestion).toContain('provider, service, region, or resource');
  });
});
