/**
 * Property 12: Conversation Context Maintenance
 * Validates: Requirements 11.10
 *
 * For any sequence of messages, the context maintains at most 5 turns (10 messages).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ConversationContext } from './openclaw';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const roleArb = fc.constantFrom('user' as const, 'assistant' as const);
const contentArb = fc.string({ minLength: 1, maxLength: 100 });

const messageArb = fc.record({
  role: roleArb,
  content: contentArb,
});

/**
 * Generates a sequence of 1–20 messages.
 */
const messageSequenceArb = fc.array(messageArb, { minLength: 1, maxLength: 20 });

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 12: Conversation Context Maintenance', () => {
  it('history never exceeds 10 messages (5 turns) regardless of how many are added', () => {
    /**
     * Validates: Requirements 11.10
     * For any sequence of messages, ConversationContext must keep at most
     * maxTurns * 2 = 10 messages in history.
     */
    fc.assert(
      fc.property(messageSequenceArb, (messages) => {
        const ctx = new ConversationContext();

        for (const msg of messages) {
          ctx.addMessage(msg.role, msg.content);
        }

        const history = ctx.getHistory();
        expect(history.length).toBeLessThanOrEqual(10);
      }),
      { numRuns: 100 }
    );
  });

  it('history contains the most recent messages when truncated', () => {
    /**
     * Validates: Requirements 11.10
     * When more than 10 messages are added, the history must contain the
     * last 10 messages (most recent), not the oldest ones.
     */
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 11, maxLength: 30 }),
        (messages) => {
          const ctx = new ConversationContext();

          for (const msg of messages) {
            ctx.addMessage(msg.role, msg.content);
          }

          const history = ctx.getHistory();
          const lastTen = messages.slice(-10);

          // The history content must match the last 10 messages
          expect(history.length).toBe(10);
          for (let i = 0; i < 10; i++) {
            expect(history[i].content).toBe(lastTen[i].content);
            expect(history[i].role).toBe(lastTen[i].role);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('history length equals message count when fewer than 10 messages are added', () => {
    /**
     * Validates: Requirements 11.10
     * When fewer than or equal to 10 messages are added, all messages are retained.
     */
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 0, maxLength: 10 }),
        (messages) => {
          const ctx = new ConversationContext();

          for (const msg of messages) {
            ctx.addMessage(msg.role, msg.content);
          }

          const history = ctx.getHistory();
          expect(history.length).toBe(messages.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('clear() resets history to empty regardless of prior messages', () => {
    /**
     * Validates: Requirements 11.10
     * After clear(), the history must always be empty.
     */
    fc.assert(
      fc.property(messageSequenceArb, (messages) => {
        const ctx = new ConversationContext();

        for (const msg of messages) {
          ctx.addMessage(msg.role, msg.content);
        }

        ctx.clear();
        expect(ctx.getHistory()).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });
});
