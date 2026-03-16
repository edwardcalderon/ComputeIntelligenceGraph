/**
 * Property 11: Natural Language Query Translation
 * Validates: Requirements 11.5
 *
 * For any natural language query, the generated Cypher starts with MATCH or CALL or WITH.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal mock LLM that returns a Cypher query.
 */
function makeMockLLM(cypherQuery: string) {
  return {
    invoke: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        answer: 'Here is the query result.',
        cypher: cypherQuery,
        needsClarification: false,
      }),
    }),
  };
}

/**
 * Creates an OpenClawAgent with the LLM constructor mocked out.
 */
async function makeAgent(cypherQuery: string) {
  // Mock ChatOpenAI before importing OpenClawAgent
  vi.doMock('@langchain/openai', () => ({
    ChatOpenAI: vi.fn().mockImplementation(() => makeMockLLM(cypherQuery)),
  }));

  const { OpenClawAgent } = await import('./openclaw.js');
  return new OpenClawAgent(null, null);
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const nlQueryArb = fc.string({ minLength: 1, maxLength: 200 });
const cypherPrefixArb = fc.constantFrom('MATCH', 'CALL', 'WITH');
const cypherBodyArb = fc.string({ minLength: 1, maxLength: 30 }).map((s) =>
  s.replace(/[^\w\s]/g, 'x')
);

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 11: Natural Language Query Translation', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('generateCypher() returns a query starting with MATCH, CALL, or WITH for any input', async () => {
    /**
     * Validates: Requirements 11.5
     * For any natural language query, the generated Cypher must start with
     * MATCH, CALL, or WITH (case-insensitive).
     */
    await fc.assert(
      fc.asyncProperty(nlQueryArb, cypherPrefixArb, cypherBodyArb, async (nlQuery, prefix, body) => {
        const cypherQuery = `${prefix} (n:Resource ${body}) RETURN n`;

        vi.doMock('@langchain/openai', () => ({
          ChatOpenAI: vi.fn().mockImplementation(() => ({
            invoke: vi.fn().mockResolvedValue({ content: cypherQuery }),
          })),
        }));

        const { OpenClawAgent } = await import('./openclaw.js');
        const agent = new OpenClawAgent(null, null);

        const result = await agent.generateCypher(nlQuery);

        const trimmed = result.trim().toUpperCase();
        const startsWithValid =
          trimmed.startsWith('MATCH') ||
          trimmed.startsWith('CALL') ||
          trimmed.startsWith('WITH');

        expect(startsWithValid).toBe(true);

        vi.resetModules();
      }),
      { numRuns: 30 }
    );
  });

  it('query() response cypher field starts with MATCH, CALL, or WITH when present', async () => {
    /**
     * Validates: Requirements 11.5
     * When the LLM returns a cypher field in the response, it must start with
     * a valid Cypher keyword.
     */
    await fc.assert(
      fc.asyncProperty(nlQueryArb, cypherPrefixArb, async (nlQuery, prefix) => {
        const cypherQuery = `${prefix} (n:Resource) RETURN n LIMIT 10`;

        vi.doMock('@langchain/openai', () => ({
          ChatOpenAI: vi.fn().mockImplementation(() => ({
            invoke: vi.fn().mockResolvedValue({
              content: JSON.stringify({
                answer: 'Result',
                cypher: cypherQuery,
                needsClarification: false,
              }),
            }),
          })),
        }));

        const { OpenClawAgent } = await import('./openclaw.js');
        const agent = new OpenClawAgent(null, null);

        const response = await agent.query(nlQuery, 'test-session');

        if (response.cypher) {
          const trimmed = response.cypher.trim().toUpperCase();
          const startsWithValid =
            trimmed.startsWith('MATCH') ||
            trimmed.startsWith('CALL') ||
            trimmed.startsWith('WITH');
          expect(startsWithValid).toBe(true);
        }

        vi.resetModules();
      }),
      { numRuns: 30 }
    );
  });

  it('generateCypher() always returns a non-empty string for any input', async () => {
    /**
     * Validates: Requirements 11.5
     * The Cypher translation must never return an empty string.
     */
    await fc.assert(
      fc.asyncProperty(nlQueryArb, async (nlQuery) => {
        vi.doMock('@langchain/openai', () => ({
          ChatOpenAI: vi.fn().mockImplementation(() => ({
            invoke: vi.fn().mockResolvedValue({
              content: 'MATCH (n:Resource) RETURN n LIMIT 10',
            }),
          })),
        }));

        const { OpenClawAgent } = await import('./openclaw.js');
        const agent = new OpenClawAgent(null, null);

        const result = await agent.generateCypher(nlQuery);
        expect(result.trim().length).toBeGreaterThan(0);

        vi.resetModules();
      }),
      { numRuns: 20 }
    );
  });
});
