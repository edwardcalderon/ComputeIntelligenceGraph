/**
 * E2E-style tests for conversational agent flows.
 * Tests the full query path through OpenClawAgent without real LLM/AWS calls.
 * Validates: Requirements 26.3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @langchain/openai before importing openclaw
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn(),
  })),
}));

import { OpenClawAgent, ConversationContext } from './openclaw.js';
import { ActionExecutor, Permission } from './openfang.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAgent(ragPipeline = null, actionExecutor: ActionExecutor | null = null) {
  const agent = new OpenClawAgent(ragPipeline, actionExecutor);
  const mockInvoke = vi.fn();
  (agent as unknown as Record<string, unknown>)['llm'] = { invoke: mockInvoke };
  return { agent, mockInvoke };
}

function llmResponse(answer: string, extra: Record<string, unknown> = {}) {
  return { content: JSON.stringify({ answer, needsClarification: false, ...extra }) };
}

// ─── E2E: EC2 instance count query ───────────────────────────────────────────

describe('E2E: user asks "How many EC2 instances?"', () => {
  it('agent returns an answer with EC2 count', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce(
      llmResponse('You have 5 EC2 instances running in us-east-1.')
    );

    const result = await agent.query('How many EC2 instances do I have?', 'e2e-ec2');

    expect(result.answer).toContain('EC2');
    expect(result.needsClarification).toBe(false);
  });

  it('agent includes a Cypher query when graph traversal is needed', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce({
      content: JSON.stringify({
        answer: 'You have 5 EC2 instances.',
        cypher: 'MATCH (r:Resource {type: "EC2"}) RETURN count(r)',
        needsClarification: false,
      }),
    });

    const result = await agent.query('How many EC2 instances?', 'e2e-cypher');

    expect(result.cypher).toContain('MATCH');
    expect(result.cypher).toContain('EC2');
  });

  it('agent handles ambiguous query by asking for clarification', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce({
      content: JSON.stringify({
        answer: 'Could you clarify which region?',
        needsClarification: true,
        clarifyingQuestion: 'Which AWS region are you asking about?',
      }),
    });

    const result = await agent.query('How many instances?', 'e2e-clarify');

    expect(result.needsClarification).toBe(true);
    expect(result.clarifyingQuestion).toBeTruthy();
  });
});

// ─── E2E: cost query flow ─────────────────────────────────────────────────────

describe('E2E: user asks "What are my most expensive resources?"', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('agent fetches cost data and returns answer with cost info', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce(
      llmResponse('Your most expensive resource is EC2 at $200/month.')
    );

    const mockCostData = {
      totalMonthlyCost: 350,
      currency: 'USD',
      resourceCosts: [
        { resourceId: 'aws:ec2:i-001', amount: 200, currency: 'USD' },
        { resourceId: 'aws:rds:db-001', amount: 100, currency: 'USD' },
        { resourceId: 'aws:s3:bucket-001', amount: 50, currency: 'USD' },
      ],
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCostData,
    });

    const result = await agent.query('What are my most expensive resources?', 'e2e-cost');

    expect(result.answer).toContain('EC2');
    expect(result.needsClarification).toBe(false);

    // Verify cost context was injected into the LLM call
    const messages = mockInvoke.mock.calls[0][0] as Array<{ content: string }>;
    expect(messages[0].content).toContain('[Cost Data]');
    expect(messages[0].content).toContain('350.00 USD');
  });

  it('agent returns answer even when cost API is unavailable', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce(
      llmResponse('I could not retrieve cost data at this time.')
    );
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    const result = await agent.query('What are my most expensive resources?', 'e2e-cost-fail');

    expect(result.answer).toBeTruthy();
    expect(result.needsClarification).toBe(false);
  });

  it('agent does not fetch cost data for non-cost queries', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce(llmResponse('You have 3 VPCs.'));

    await agent.query('How many VPCs do I have?', 'e2e-no-cost');

    expect(fetch).not.toHaveBeenCalled();
  });
});

// ─── E2E: security query flow ─────────────────────────────────────────────────

describe('E2E: user asks "What security issues do I have?"', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('agent fetches security data and returns answer with findings', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce(
      llmResponse('You have 2 critical security findings: SSH open to world and public S3 bucket.')
    );

    const mockFindings = {
      findings: [
        { id: 'f-1', resourceId: 'sg-001', severity: 'critical', title: 'SSH open to 0.0.0.0/0' },
        { id: 'f-2', resourceId: 'bucket-001', severity: 'high', title: 'S3 bucket publicly accessible' },
      ],
    };
    const mockScore = { score: 40, maxScore: 100, grade: 'D' };

    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => mockFindings })
      .mockResolvedValueOnce({ ok: true, json: async () => mockScore });

    const result = await agent.query('What security issues do I have?', 'e2e-security');

    expect(result.answer).toBeTruthy();
    expect(result.needsClarification).toBe(false);

    const messages = mockInvoke.mock.calls[0][0] as Array<{ content: string }>;
    expect(messages[0].content).toContain('[Security Data]');
    expect(messages[0].content).toContain('Security Score: 40/100');
    expect(messages[0].content).toContain('SSH open to 0.0.0.0/0');
  });

  it('agent returns answer even when security API is unavailable', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce(
      llmResponse('Security data is currently unavailable.')
    );
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Connection refused'));

    const result = await agent.query('Any security vulnerabilities?', 'e2e-sec-fail');

    expect(result.answer).toBeTruthy();
  });

  it('agent does not fetch security data for non-security queries', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce(llmResponse('You have 10 S3 buckets.'));

    await agent.query('How many S3 buckets do I have?', 'e2e-no-sec');

    expect(fetch).not.toHaveBeenCalled();
  });
});

// ─── E2E: action flow — stop instance with confirmation ───────────────────────

describe('E2E: user asks "Stop instance i-123" → confirmation → action executed', () => {
  it('full action flow: request → confirmation prompt → confirm → success', async () => {
    const executor = new ActionExecutor(new Set([Permission.EXECUTE_ACTIONS]));
    const { agent, mockInvoke } = makeAgent(null, executor);

    // Turn 1: user requests stop
    mockInvoke.mockResolvedValueOnce({
      content: JSON.stringify({
        answer: 'I will stop EC2 instance i-123.',
        needsClarification: false,
        action: { type: 'STOP_EC2_INSTANCE', resourceId: 'i-123', params: {} },
      }),
    });

    const turn1 = await agent.query('Stop instance i-123', 'e2e-action');

    // Should ask for confirmation (destructive action)
    expect(turn1.answer).toContain("Reply 'confirm' to proceed.");

    // Turn 2: user confirms
    const turn2 = await agent.query('confirm', 'e2e-action');

    expect(turn2.answer).toContain("✓ EC2 instance 'i-123' stopped successfully.");
  });

  it('non-destructive action (create S3 bucket) executes immediately without confirmation', async () => {
    const executor = new ActionExecutor(new Set([Permission.EXECUTE_ACTIONS]));
    const { agent, mockInvoke } = makeAgent(null, executor);

    mockInvoke.mockResolvedValueOnce({
      content: JSON.stringify({
        answer: 'Creating S3 bucket my-new-bucket.',
        needsClarification: false,
        action: { type: 'CREATE_S3_BUCKET', resourceId: 'my-new-bucket', params: { bucketName: 'my-new-bucket' } },
      }),
    });

    const result = await agent.query('Create an S3 bucket named my-new-bucket', 'e2e-create');

    expect(result.answer).toContain("✓ S3 bucket 'my-new-bucket' created successfully.");
  });

  it('action fails gracefully when user lacks permissions', async () => {
    const executor = new ActionExecutor(new Set()); // no permissions
    const { agent, mockInvoke } = makeAgent(null, executor);

    mockInvoke.mockResolvedValueOnce({
      content: JSON.stringify({
        answer: 'Creating S3 bucket.',
        needsClarification: false,
        action: { type: 'CREATE_S3_BUCKET', resourceId: 'bucket-x', params: {} },
      }),
    });

    const result = await agent.query('Create bucket bucket-x', 'e2e-no-perm');

    expect(result.answer).toContain('✗ Action failed:');
    expect(result.answer).toContain('Permission denied');
  });
});

// ─── E2E: multi-turn conversation maintaining context ─────────────────────────

describe('E2E: multi-turn conversation (3 turns) maintaining context', () => {
  it('conversation history is passed to LLM on each subsequent turn', async () => {
    const { agent, mockInvoke } = makeAgent();

    mockInvoke
      .mockResolvedValueOnce(llmResponse('You have 5 EC2 instances.'))
      .mockResolvedValueOnce(llmResponse('3 of them are in us-east-1.'))
      .mockResolvedValueOnce(llmResponse('The most expensive one costs $120/month.'));

    const sessionId = 'e2e-multiturn';

    const turn1 = await agent.query('How many EC2 instances do I have?', sessionId);
    expect(turn1.answer).toContain('5 EC2');

    const turn2 = await agent.query('How many are in us-east-1?', sessionId);
    expect(turn2.answer).toContain('us-east-1');

    const turn3 = await agent.query('Which one is the most expensive?', sessionId);
    expect(turn3.answer).toContain('$120');

    // Turn 2 should have received history from turn 1 (system + user + assistant + new user = 4 msgs)
    const turn2Messages = mockInvoke.mock.calls[1][0] as Array<{ content: string }>;
    expect(turn2Messages.length).toBeGreaterThanOrEqual(4);

    // Turn 3 should have received history from turns 1 and 2 (system + 2*user + 2*assistant + new user = 6 msgs)
    const turn3Messages = mockInvoke.mock.calls[2][0] as Array<{ content: string }>;
    expect(turn3Messages.length).toBeGreaterThanOrEqual(6);
  });

  it('conversation context is isolated per session ID', async () => {
    const { agent, mockInvoke } = makeAgent();

    mockInvoke
      .mockResolvedValueOnce(llmResponse('Session A: You have 5 EC2 instances.'))
      .mockResolvedValueOnce(llmResponse('Session B: You have 2 RDS databases.'))
      .mockResolvedValueOnce(llmResponse('Session A: 3 are in us-east-1.'));

    await agent.query('How many EC2 instances?', 'session-A');
    await agent.query('How many RDS databases?', 'session-B');
    await agent.query('How many are in us-east-1?', 'session-A');

    // Session A turn 2 should have history from session A turn 1 only
    const sessionATurn2Messages = mockInvoke.mock.calls[2][0] as Array<{ content: string }>;
    const historyContents = sessionATurn2Messages.map((m) => m.content).join(' ');
    expect(historyContents).toContain('EC2 instances');
    // Session B content should not bleed into session A
    expect(historyContents).not.toContain('RDS databases');
  });

  it('conversation context is bounded to last 5 turns (10 messages)', async () => {
    const ctx = new ConversationContext();

    // Add 7 turns
    for (let i = 0; i < 7; i++) {
      ctx.addMessage('user', `question ${i}`);
      ctx.addMessage('assistant', `answer ${i}`);
    }

    const history = ctx.getHistory();
    // Only last 5 turns (10 messages) should be retained
    expect(history).toHaveLength(10);
    expect(history[0].content).toBe('question 2');
    expect(history[history.length - 1].content).toBe('answer 6');
  });
});
