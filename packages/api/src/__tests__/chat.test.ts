import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { GraphQueryEngine, Provider, ResourceState, ResourceType, type Resource_Model } from '@cig/graph';
import { CartographyClient } from '@cig/discovery';
import { createServer } from '../index';
import { clearPersistedChatSessionsForTests } from '../chat-store';
import { generateJwt, Permission } from '../auth';
import { answerChatQuestion, type ChatInfrastructureSnapshot } from '../chat';

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

function buildMultipartBody(
  boundary: string,
  parts: Array<
    | { type: 'field'; name: string; value: string }
    | { type: 'file'; name: string; filename: string; mimeType: string; content: string }
  >
): string {
  return parts
    .map((part) => {
      if (part.type === 'field') {
        return [
          `--${boundary}`,
          `Content-Disposition: form-data; name="${part.name}"`,
          '',
          part.value,
        ].join('\r\n');
      }

      return [
        `--${boundary}`,
        `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"`,
        `Content-Type: ${part.mimeType}`,
        '',
        part.content,
      ].join('\r\n');
    })
    .concat(`--${boundary}--`)
    .join('\r\n');
}

describe('POST /api/v1/chat', () => {
  let app: FastifyInstance;
  const searchResourcesSpy = vi.spyOn(GraphQueryEngine.prototype, 'searchResources');
  const getResourceCountsSpy = vi.spyOn(GraphQueryEngine.prototype, 'getResourceCounts');
  const listResourcesPagedSpy = vi.spyOn(GraphQueryEngine.prototype, 'listResourcesPaged');
  const cartographyHealthSpy = vi.spyOn(CartographyClient.prototype, 'healthCheck');
  const cartographyStatusSpy = vi.spyOn(CartographyClient.prototype, 'getStatus');

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
    getResourceCountsSpy.mockRestore();
    listResourcesPagedSpy.mockRestore();
    cartographyHealthSpy.mockRestore();
    cartographyStatusSpy.mockRestore();
    await app.close();
  });

  beforeEach(async () => {
    searchResourcesSpy.mockReset();
    getResourceCountsSpy.mockReset();
    listResourcesPagedSpy.mockReset();
    cartographyHealthSpy.mockReset();
    cartographyStatusSpy.mockReset();
    getResourceCountsSpy.mockResolvedValue({});
    listResourcesPagedSpy.mockResolvedValue({ items: [], total: 0, hasMore: false });
    cartographyHealthSpy.mockResolvedValue(true);
    cartographyStatusSpy.mockResolvedValue({
      running: true,
      run_count: 1,
      last_run_start: '2026-03-26T00:00:00.000Z',
      last_run_end: null,
      last_run_success: true,
      last_error: null,
    });
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

  it('persists user context item metadata in session history', async () => {
    searchResourcesSpy.mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      headers: {
        authorization: makeAuthHeader(),
      },
      payload: {
        contextItems: [
          {
            type: 'code_snippet',
            language: 'sql',
            title: 'Cost SQL',
            content: 'SELECT service, amount FROM usage_costs LIMIT 25;',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ sessionId: string }>();

    const messagesResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/chat/sessions/${body.sessionId}/messages`,
      headers: {
        authorization: makeAuthHeader(),
      },
    });

    expect(messagesResponse.statusCode).toBe(200);
    const messages = messagesResponse.json<{
      items: Array<{
        role: 'user' | 'assistant';
        content: string;
        contextItems?: Array<{ type: string; language?: string; title?: string }>;
      }>;
    }>();

    expect(messages.items[0]?.contextItems).toEqual([
      expect.objectContaining({
        type: 'code_snippet',
        language: 'sql',
        title: 'Cost SQL',
      }),
    ]);
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
    expect(body.clarifyingQuestion).toContain('local self-hosted');
    expect(body.answer).toContain('Discovery is reachable');
    expect(body.answer).toContain('docker-compose -f docker-compose.dev.yml up -d');
    expect(body.answer).toContain('http://localhost:3004/documentation');

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
    expect(messages.items[1]?.content).toContain('Discovery is reachable');
    expect(messages.items[1]?.content).toContain('docker-compose -f docker-compose.dev.yml up -d');
    expect(messages.items[1]?.content).toContain('http://localhost:3004/documentation');

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

  it('accepts text document uploads and returns normalized attachment metadata', async () => {
    const boundary = '----chat-upload-boundary';
    const payload = buildMultipartBody(boundary, [
      {
        type: 'file',
        name: 'file',
        filename: 'schema.sql',
        mimeType: 'text/x-sql',
        content: 'SELECT * FROM schema_migrations;',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/chat/uploads',
      headers: {
        authorization: makeAuthHeader(),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ item: { type: string; name: string; kind: string } }>()).toEqual({
      item: expect.objectContaining({
        type: 'attachment',
        name: 'schema.sql',
        kind: 'document',
      }),
    });
  });

  it('transcribes audio uploads through the OpenAI transcription API', async () => {
    process.env['OPENAI_API_KEY'] = 'test-openai-key';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ text: 'Database CPU is spiking in prod.' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    ) as typeof fetch;

    const boundary = '----chat-audio-boundary';
    const payload = buildMultipartBody(boundary, [
      { type: 'field', name: 'durationMs', value: '1500' },
      { type: 'field', name: 'mode', value: 'review' },
      {
        type: 'file',
        name: 'file',
        filename: 'voice.ogg',
        mimeType: 'audio/ogg; codecs=opus',
        content: 'fake-audio-content',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/chat/transcriptions',
      headers: {
        authorization: makeAuthHeader(),
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ text: string; item: { type: string; mode: string } }>()).toEqual({
      text: 'Database CPU is spiking in prod.',
      item: expect.objectContaining({
        type: 'transcript',
        mode: 'review',
      }),
    });

    globalThis.fetch = originalFetch;
    process.env['OPENAI_API_KEY'] = '';
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

  it('summarizes actual resources when no exact match is found', async () => {
    const infrastructure: ChatInfrastructureSnapshot = {
      deploymentMode: 'self-hosted',
      discoveryHealthy: true,
      discoveryRunning: false,
      discoveryLastRun: '2026-03-26T00:00:00.000Z',
      discoveryNextRun: '2026-03-26T00:05:00.000Z',
      resourceCounts: {
        service: 2,
        database: 1,
        compute: 4,
      },
      sampleResources: [
        makeResource(),
        {
          ...makeResource(),
          id: 'db-prod',
          name: 'prod-db',
          type: ResourceType.DATABASE,
          state: ResourceState.ACTIVE,
        },
        {
          ...makeResource(),
          id: 'worker-1',
          name: 'worker-1',
          type: ResourceType.COMPUTE,
          state: ResourceState.RUNNING,
        },
      ],
    };

    const response = await answerChatQuestion('show me the cost of my databases', [], [], infrastructure);

    expect(response.needsClarification).toBe(true);
    expect(response.answer.toLowerCase()).toContain('indexed resource');
    expect(response.answer).toContain('service: 2');
    expect(response.answer).toContain('prod-db');
    expect(response.clarifyingQuestion).toContain('provider, service, region, or resource');
  });

  it('returns setup guidance when no resources are indexed', async () => {
    const response = await answerChatQuestion('cost', [], [], {
      deploymentMode: 'self-hosted',
      discoveryHealthy: true,
      discoveryRunning: false,
      discoveryLastRun: null,
      discoveryNextRun: null,
      resourceCounts: {},
      sampleResources: [],
    });

    expect(response.needsClarification).toBe(true);
    expect(response.answer).toContain('graph still has no indexed resources yet');
    expect(response.answer).toContain('docker-compose -f docker-compose.dev.yml up -d');
    expect(response.answer).toContain('http://localhost:3004/documentation');
    expect(response.clarifyingQuestion).toContain('local self-hosted');
  });
});
