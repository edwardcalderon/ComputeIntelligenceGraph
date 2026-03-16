/**
 * Integration tests for OpenClawAgent and ConversationContext.
 * Validates: Requirements 26.2, 12.1, 12.2, 12.3, 12.4, 12.5
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @langchain/openai BEFORE importing openclaw so the ChatOpenAI
// constructor never runs real validation logic.
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn(),
  })),
}));

import { ConversationContext, OpenClawAgent } from './openclaw.js';
import type { RAGPipelineLike } from './openclaw.js';
import { ActionExecutor, Permission } from './openfang.js';

// ─── ConversationContext ──────────────────────────────────────────────────────

describe('ConversationContext', () => {
  let ctx: ConversationContext;

  beforeEach(() => {
    ctx = new ConversationContext();
  });

  it('addMessage stores messages', () => {
    ctx.addMessage('user', 'hello');
    expect(ctx.getHistory()).toHaveLength(1);
    expect(ctx.getHistory()[0]).toMatchObject({ role: 'user', content: 'hello' });
  });

  it('getHistory returns at most 10 messages (5 turns)', () => {
    // Add 7 turns (14 messages) — only last 5 turns (10 messages) should remain
    for (let i = 0; i < 7; i++) {
      ctx.addMessage('user', `question ${i}`);
      ctx.addMessage('assistant', `answer ${i}`);
    }
    const history = ctx.getHistory();
    expect(history).toHaveLength(10);
    expect(history[0]).toMatchObject({ content: 'question 2' });
  });

  it('clear empties the history', () => {
    ctx.addMessage('user', 'hello');
    ctx.addMessage('assistant', 'hi');
    ctx.clear();
    expect(ctx.getHistory()).toHaveLength(0);
  });
});

// ─── OpenClawAgent ────────────────────────────────────────────────────────────

describe('OpenClawAgent', () => {
  const validLLMResponse = JSON.stringify({
    answer: 'You have 3 EC2 instances.',
    needsClarification: false,
  });

  function makeAgent(ragPipeline: RAGPipelineLike | null = null) {
    const agent = new OpenClawAgent(ragPipeline);
    const mockInvoke = vi.fn();
    // Inject mock LLM directly — bypasses any real API calls
    (agent as unknown as Record<string, unknown>)['llm'] = { invoke: mockInvoke };
    return { agent, mockInvoke };
  }

  it('query returns OpenClawResponse with answer', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce({ content: validLLMResponse });

    const result = await agent.query('How many EC2 instances do I have?');

    expect(result.answer).toBe('You have 3 EC2 instances.');
    expect(result.needsClarification).toBe(false);
  });

  it('query adds user and assistant messages to conversation context', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValue({ content: validLLMResponse });

    await agent.query('How many EC2 instances?', 'session-1');
    await agent.query('What about S3?', 'session-1');

    // Second call should include history from first turn
    const secondCallMessages = mockInvoke.mock.calls[1][0] as Array<{ content: string }>;
    // system + user + assistant (from turn 1) + new human = 4
    expect(secondCallMessages.length).toBeGreaterThanOrEqual(4);
  });

  it('query handles LLM errors gracefully — propagates the error', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockRejectedValueOnce(new Error('OpenAI API unavailable'));

    await expect(agent.query('What is my infra?')).rejects.toThrow('OpenAI API unavailable');
  });

  it('generateCypher returns a Cypher string', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce({ content: 'MATCH (n:Resource) RETURN n LIMIT 10' });

    const cypher = await agent.generateCypher('list all resources');

    expect(cypher).toBe('MATCH (n:Resource) RETURN n LIMIT 10');
  });

  it('needsClarification is set when LLM returns it', async () => {
    const { agent, mockInvoke } = makeAgent();
    const clarifyResponse = JSON.stringify({
      answer: 'Could you clarify which region?',
      needsClarification: true,
      clarifyingQuestion: 'Which AWS region are you asking about?',
    });
    mockInvoke.mockResolvedValueOnce({ content: clarifyResponse });

    const result = await agent.query('Show me my resources');

    expect(result.needsClarification).toBe(true);
    expect(result.clarifyingQuestion).toBe('Which AWS region are you asking about?');
  });

  it('query uses RAG context when ragPipeline is provided', async () => {
    const mockRag: RAGPipelineLike = {
      assembleContext: vi.fn().mockResolvedValue('Infrastructure context:\n- my-ec2 (EC2, aws)'),
    };
    const { agent, mockInvoke } = makeAgent(mockRag);
    mockInvoke.mockResolvedValueOnce({ content: validLLMResponse });

    await agent.query('list resources');

    expect(mockRag.assembleContext).toHaveBeenCalledOnce();
    const messages = mockInvoke.mock.calls[0][0] as Array<{ content: string }>;
    expect(messages[0].content).toContain('Infrastructure context:');
  });

  it('query falls back gracefully when RAG pipeline throws', async () => {
    const mockRag: RAGPipelineLike = {
      assembleContext: vi.fn().mockRejectedValue(new Error('ChromaDB unavailable')),
    };
    const { agent, mockInvoke } = makeAgent(mockRag);
    mockInvoke.mockResolvedValueOnce({ content: validLLMResponse });

    const result = await agent.query('list resources');

    expect(result.answer).toBe('You have 3 EC2 instances.');
    // System message should use base prompt without RAG context
    const messages = mockInvoke.mock.calls[0][0] as Array<{ content: string }>;
    expect(messages[0].content).not.toContain('Infrastructure context:');
  });
});

// ─── ConversationContext — pendingAction ──────────────────────────────────────

describe('ConversationContext pendingAction', () => {
  let ctx: ConversationContext;

  beforeEach(() => {
    ctx = new ConversationContext();
  });

  it('setPendingAction stores an action', () => {
    const action = { type: 'STOP_EC2_INSTANCE', resourceId: 'i-123', params: {} };
    ctx.setPendingAction(action);
    expect(ctx.getPendingAction()).toEqual(action);
  });

  it('clearPendingAction removes the stored action', () => {
    ctx.setPendingAction({ type: 'DELETE_RESOURCE', resourceId: 'r-1', params: {} });
    ctx.clearPendingAction();
    expect(ctx.getPendingAction()).toBeUndefined();
  });

  it('clear() also removes pending action', () => {
    ctx.setPendingAction({ type: 'STOP_EC2_INSTANCE', resourceId: 'i-1', params: {} });
    ctx.clear();
    expect(ctx.getPendingAction()).toBeUndefined();
  });
});

// ─── OpenClawAgent — OpenFang integration ────────────────────────────────────

describe('OpenClawAgent + ActionExecutor integration', () => {
  const permissions = new Set([Permission.EXECUTE_ACTIONS]);

  function makeAgentWithExecutor() {
    const executor = new ActionExecutor(permissions);
    const agent = new OpenClawAgent(null, executor, 'test-user');
    const mockInvoke = vi.fn();
    (agent as unknown as Record<string, unknown>)['llm'] = { invoke: mockInvoke };
    return { agent, mockInvoke, executor };
  }

  it('executes non-destructive action immediately and appends result to answer', async () => {
    const { agent, mockInvoke } = makeAgentWithExecutor();
    const llmResponse = JSON.stringify({
      answer: 'Creating S3 bucket my-bucket.',
      needsClarification: false,
      action: { type: 'CREATE_S3_BUCKET', resourceId: 'my-bucket', params: { bucketName: 'my-bucket' } },
    });
    mockInvoke.mockResolvedValueOnce({ content: llmResponse });

    const result = await agent.query('Create an S3 bucket named my-bucket');

    expect(result.answer).toContain('Creating S3 bucket my-bucket.');
    expect(result.answer).toContain("✓ S3 bucket 'my-bucket' created successfully.");
  });

  it('stores destructive action as pending and prompts for confirmation', async () => {
    const { agent, mockInvoke } = makeAgentWithExecutor();
    const llmResponse = JSON.stringify({
      answer: 'Stopping EC2 instance i-123.',
      needsClarification: false,
      action: { type: 'STOP_EC2_INSTANCE', resourceId: 'i-123', params: {} },
    });
    mockInvoke.mockResolvedValueOnce({ content: llmResponse });

    const result = await agent.query('Stop instance i-123', 'sess-1');

    expect(result.answer).toContain("Reply 'confirm' to proceed.");
  });

  it('executes pending destructive action when user replies confirm', async () => {
    const { agent, mockInvoke } = makeAgentWithExecutor();

    // First query — LLM returns destructive action
    const llmResponse = JSON.stringify({
      answer: 'Stopping EC2 instance i-123.',
      needsClarification: false,
      action: { type: 'STOP_EC2_INSTANCE', resourceId: 'i-123', params: {} },
    });
    mockInvoke.mockResolvedValueOnce({ content: llmResponse });
    await agent.query('Stop instance i-123', 'sess-confirm');

    // Second query — user confirms
    const confirmResult = await agent.query('confirm', 'sess-confirm');

    expect(confirmResult.answer).toContain("✓ EC2 instance 'i-123' stopped successfully.");
  });

  it('clears pending action after confirmation', async () => {
    const { agent, mockInvoke } = makeAgentWithExecutor();

    const llmResponse = JSON.stringify({
      answer: 'Stopping EC2 instance i-456.',
      needsClarification: false,
      action: { type: 'STOP_EC2_INSTANCE', resourceId: 'i-456', params: {} },
    });
    mockInvoke.mockResolvedValueOnce({ content: llmResponse });
    await agent.query('Stop instance i-456', 'sess-clear');

    // Confirm
    await agent.query('confirm', 'sess-clear');

    // A second 'confirm' with no pending action should fall through to LLM
    const noopResponse = JSON.stringify({ answer: 'No pending action.', needsClarification: false });
    mockInvoke.mockResolvedValueOnce({ content: noopResponse });
    const result = await agent.query('confirm', 'sess-clear');
    expect(result.answer).toBe('No pending action.');
  });

  it('handles action execution errors gracefully', async () => {
    const executor = new ActionExecutor(new Set()); // no permissions
    const agent = new OpenClawAgent(null, executor, 'test-user');
    const mockInvoke = vi.fn();
    (agent as unknown as Record<string, unknown>)['llm'] = { invoke: mockInvoke };

    const llmResponse = JSON.stringify({
      answer: 'Creating S3 bucket.',
      needsClarification: false,
      action: { type: 'CREATE_S3_BUCKET', resourceId: 'my-bucket', params: {} },
    });
    mockInvoke.mockResolvedValueOnce({ content: llmResponse });

    const result = await agent.query('Create bucket');

    expect(result.answer).toContain('✗ Action failed:');
    expect(result.answer).toContain('Permission denied');
  });

  it('does not execute actions when no ActionExecutor is provided', async () => {
    const agent = new OpenClawAgent(null, null);
    const mockInvoke = vi.fn();
    (agent as unknown as Record<string, unknown>)['llm'] = { invoke: mockInvoke };

    const llmResponse = JSON.stringify({
      answer: 'Creating S3 bucket.',
      needsClarification: false,
      action: { type: 'CREATE_S3_BUCKET', resourceId: 'my-bucket', params: {} },
    });
    mockInvoke.mockResolvedValueOnce({ content: llmResponse });

    const result = await agent.query('Create bucket');

    // Answer unchanged — no execution appended
    expect(result.answer).toBe('Creating S3 bucket.');
  });
});

// ─── OpenClawAgent — cost queries (Req 29.9) ─────────────────────────────────

describe('OpenClawAgent cost queries', () => {
  const validLLMResponse = JSON.stringify({
    answer: 'Your most expensive resource is aws:service:EC2 at $120.00/month.',
    needsClarification: false,
  });

  function makeAgent() {
    const agent = new OpenClawAgent(null, null);
    const mockInvoke = vi.fn();
    (agent as unknown as Record<string, unknown>)['llm'] = { invoke: mockInvoke };
    return { agent, mockInvoke };
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includes cost data in context for cost-related queries', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce({ content: validLLMResponse });

    const mockCostData = {
      totalMonthlyCost: 250.5,
      currency: 'USD',
      resourceCosts: [
        { resourceId: 'aws:service:EC2', amount: 120.0, currency: 'USD' },
        { resourceId: 'aws:service:RDS', amount: 80.5, currency: 'USD' },
        { resourceId: 'aws:service:S3', amount: 50.0, currency: 'USD' },
      ],
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCostData,
    });

    await agent.query('What are my most expensive resources?');

    const messages = mockInvoke.mock.calls[0][0] as Array<{ content: string }>;
    const systemMsg = messages[0].content;
    expect(systemMsg).toContain('[Cost Data]');
    expect(systemMsg).toContain('250.50 USD');
    expect(systemMsg).toContain('aws:service:EC2');
    expect(systemMsg).toContain('120.00');
  });

  it('detects cost keywords: spending, billing, cheapest, how much, budget', async () => {
    const keywords = ['spending', 'billing', 'cheapest', 'how much', 'budget', 'price'];
    for (const kw of keywords) {
      const { agent, mockInvoke } = makeAgent();
      mockInvoke.mockResolvedValueOnce({ content: validLLMResponse });
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalMonthlyCost: 10, currency: 'USD', resourceCosts: [] }),
      });

      await agent.query(`Show me my ${kw}`);
      expect(fetch).toHaveBeenCalled();
      vi.clearAllMocks();
    }
  });

  it('does not fetch cost data for non-cost queries', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce({ content: validLLMResponse });

    await agent.query('How many EC2 instances do I have?');

    expect(fetch).not.toHaveBeenCalled();
  });

  it('handles cost API unavailability gracefully', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce({ content: validLLMResponse });
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Connection refused'));

    // Should not throw — proceeds without cost context
    const result = await agent.query('What is my total cost?');
    expect(result.answer).toBeTruthy();

    const messages = mockInvoke.mock.calls[0][0] as Array<{ content: string }>;
    expect(messages[0].content).not.toContain('[Cost Data]');
  });

  it('handles non-ok API response gracefully', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce({ content: validLLMResponse });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });

    const result = await agent.query('Show me billing info');
    expect(result.answer).toBeTruthy();

    const messages = mockInvoke.mock.calls[0][0] as Array<{ content: string }>;
    expect(messages[0].content).not.toContain('[Cost Data]');
  });

  it('sorts resources by cost descending and limits to top 10', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce({ content: validLLMResponse });

    const resourceCosts = Array.from({ length: 15 }, (_, i) => ({
      resourceId: `aws:service:Service${i}`,
      amount: i * 10,
      currency: 'USD',
    }));
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ totalMonthlyCost: 1050, currency: 'USD', resourceCosts }),
    });

    await agent.query('What are my most expensive resources?');

    const messages = mockInvoke.mock.calls[0][0] as Array<{ content: string }>;
    const systemMsg = messages[0].content;
    // Top resource should be Service14 (amount: 140)
    expect(systemMsg).toContain('Service14');
    // Service0 (amount: 0) should not appear (outside top 10)
    expect(systemMsg).not.toContain('Service0');
  });
});

// ─── OpenClawAgent — security queries (Req 30.10) ────────────────────────────

describe('OpenClawAgent security queries', () => {
  const validLLMResponse = JSON.stringify({
    answer: 'You have 3 critical security findings.',
    needsClarification: false,
  });

  function makeAgent() {
    const agent = new OpenClawAgent(null, null);
    const mockInvoke = vi.fn();
    (agent as unknown as Record<string, unknown>)['llm'] = { invoke: mockInvoke };
    return { agent, mockInvoke };
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includes security data in context for security-related queries', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce({ content: validLLMResponse });

    const mockFindings = {
      findings: [
        { id: 'f-1', resourceId: 'i-123', severity: 'critical', title: 'SSH port open to world' },
        { id: 'f-2', resourceId: 'bucket-1', severity: 'high', title: 'S3 bucket public access' },
        { id: 'f-3', resourceId: 'sg-1', severity: 'medium', title: 'Unused security group' },
      ],
    };
    const mockScore = { score: 45, maxScore: 100, grade: 'C', findingsBySeverity: { critical: 1, high: 1, medium: 1, low: 0 } };

    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => mockFindings })
      .mockResolvedValueOnce({ ok: true, json: async () => mockScore });

    await agent.query('What security issues do I have?');

    const messages = mockInvoke.mock.calls[0][0] as Array<{ content: string }>;
    const systemMsg = messages[0].content;
    expect(systemMsg).toContain('[Security Data]');
    expect(systemMsg).toContain('Security Score: 45/100');
    expect(systemMsg).toContain('Grade: C');
    expect(systemMsg).toContain('SSH port open to world');
    expect(systemMsg).toContain('[CRITICAL]');
  });

  it('detects security keywords correctly', async () => {
    const keywords = ['security', 'vulnerability', 'misconfiguration', 'finding', 'findings',
      'risk', 'compliance', 'exposed', 'public access', 'ssh', 'open port', 'iam', 'access key'];

    for (const kw of keywords) {
      const { agent, mockInvoke } = makeAgent();
      mockInvoke.mockResolvedValueOnce({ content: validLLMResponse });
      (fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ findings: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ score: 100, maxScore: 100, grade: 'A' }) });

      await agent.query(`Tell me about ${kw}`);
      expect(fetch).toHaveBeenCalled();
      vi.clearAllMocks();
    }
  });

  it('does not fetch security data for non-security queries', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce({ content: validLLMResponse });

    await agent.query('How many EC2 instances do I have?');

    expect(fetch).not.toHaveBeenCalled();
  });

  it('handles security API unavailability gracefully', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce({ content: validLLMResponse });
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Connection refused'));

    const result = await agent.query('Do I have any security vulnerabilities?');
    expect(result.answer).toBeTruthy();

    const messages = mockInvoke.mock.calls[0][0] as Array<{ content: string }>;
    expect(messages[0].content).not.toContain('[Security Data]');
  });

  it('sorts findings by severity (critical > high > medium > low) and limits to top 10', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce({ content: validLLMResponse });

    const findings = [
      ...Array.from({ length: 5 }, (_, i) => ({ id: `low-${i}`, severity: 'low', title: `Low finding ${i}` })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: `medium-${i}`, severity: 'medium', title: `Medium finding ${i}` })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: `critical-${i}`, severity: 'critical', title: `Critical finding ${i}` })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `high-${i}`, severity: 'high', title: `High finding ${i}` })),
    ];

    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ findings }) })
      .mockResolvedValueOnce({ ok: false });

    await agent.query('Show me my security findings');

    const messages = mockInvoke.mock.calls[0][0] as Array<{ content: string }>;
    const systemMsg = messages[0].content;
    // Critical findings should appear first
    expect(systemMsg).toContain('Critical finding 0');
    // Low findings should be cut off (only top 10 of 17 total)
    expect(systemMsg).not.toContain('Low finding');
  });

  it('handles items array format from findings API', async () => {
    const { agent, mockInvoke } = makeAgent();
    mockInvoke.mockResolvedValueOnce({ content: validLLMResponse });

    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'f-1', severity: 'high', title: 'IAM key exposed' }] }),
      })
      .mockResolvedValueOnce({ ok: false });

    await agent.query('Any IAM issues?');

    const messages = mockInvoke.mock.calls[0][0] as Array<{ content: string }>;
    expect(messages[0].content).toContain('IAM key exposed');
  });
});
