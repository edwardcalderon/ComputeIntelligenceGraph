import { describe, it, expect } from 'vitest';
import { Logger, type LogEntry, type LogLevel } from '../lib/logger.js';
import { OrchestratorError } from '../lib/errors.js';

/** Capture log output lines from a Logger. */
function createTestLogger(
  overrides: { component?: string; sessionId?: string; minLevel?: LogLevel } = {},
): { logger: Logger; lines: string[] } {
  const lines: string[] = [];
  const logger = new Logger({
    component: overrides.component ?? 'test-component',
    sessionId: overrides.sessionId ?? 'sess-001',
    minLevel: overrides.minLevel,
    writer: (line: string) => lines.push(line),
  });
  return { logger, lines };
}

/** Parse the first captured line as a LogEntry. */
function parseFirst(lines: string[]): LogEntry {
  expect(lines.length).toBeGreaterThanOrEqual(1);
  return JSON.parse(lines[0]) as LogEntry;
}

describe('Logger', () => {
  describe('structured output', () => {
    it('outputs valid JSON with all required fields', () => {
      const { logger, lines } = createTestLogger();
      logger.info('hello world');

      const entry = parseFirst(lines);
      expect(entry.timestamp).toBeDefined();
      expect(entry.level).toBe('info');
      expect(entry.component).toBe('test-component');
      expect(entry.sessionId).toBe('sess-001');
      expect(entry.message).toBe('hello world');
    });

    it('produces a valid ISO 8601 timestamp', () => {
      const { logger, lines } = createTestLogger();
      logger.info('ts check');

      const entry = parseFirst(lines);
      const parsed = new Date(entry.timestamp);
      expect(parsed.toISOString()).toBe(entry.timestamp);
    });

    it('does not include error field when no error is provided', () => {
      const { logger, lines } = createTestLogger();
      logger.info('no error');

      const entry = parseFirst(lines);
      expect(entry.error).toBeUndefined();
    });
  });

  describe('log levels', () => {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'critical'];

    it.each(levels)('supports %s level', (level) => {
      const { logger, lines } = createTestLogger();
      logger[level](`msg at ${level}`);

      const entry = parseFirst(lines);
      expect(entry.level).toBe(level);
      expect(entry.message).toBe(`msg at ${level}`);
    });
  });

  describe('minLevel filtering', () => {
    it('suppresses messages below the minimum level', () => {
      const { logger, lines } = createTestLogger({ minLevel: 'warn' });
      logger.debug('should be suppressed');
      logger.info('also suppressed');
      logger.warn('visible');

      expect(lines).toHaveLength(1);
      const entry = parseFirst(lines);
      expect(entry.level).toBe('warn');
    });

    it('emits messages at or above the minimum level', () => {
      const { logger, lines } = createTestLogger({ minLevel: 'error' });
      logger.error('err');
      logger.critical('crit');

      expect(lines).toHaveLength(2);
      expect((JSON.parse(lines[0]) as LogEntry).level).toBe('error');
      expect((JSON.parse(lines[1]) as LogEntry).level).toBe('critical');
    });

    it('defaults to debug (all messages pass)', () => {
      const { logger, lines } = createTestLogger();
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      logger.critical('c');

      expect(lines).toHaveLength(5);
    });
  });

  describe('error details', () => {
    it('includes error name, message, and stack', () => {
      const { logger, lines } = createTestLogger();
      const err = new Error('something broke');
      logger.error('failure', err);

      const entry = parseFirst(lines);
      expect(entry.error).toBeDefined();
      expect(entry.error!.name).toBe('Error');
      expect(entry.error!.message).toBe('something broke');
      expect(entry.error!.stack).toBeDefined();
    });

    it('includes OrchestratorError category and context', () => {
      const { logger, lines } = createTestLogger();
      const err = new OrchestratorError('auth failed', 'auth_error', {
        component: 'google-auth',
        sessionId: 'sess-001',
      });
      logger.error('auth issue', err);

      const entry = parseFirst(lines);
      expect(entry.error).toBeDefined();
      expect(entry.error!.category).toBe('auth_error');
      expect(entry.error!.context).toEqual({
        component: 'google-auth',
        sessionId: 'sess-001',
      });
    });
  });

  describe('child logger', () => {
    it('inherits sessionId but uses a new component', () => {
      const { logger, lines } = createTestLogger({
        component: 'parent',
        sessionId: 'sess-parent',
      });
      const child = logger.child('child-component');
      child.info('from child');

      const entry = parseFirst(lines);
      expect(entry.component).toBe('child-component');
      expect(entry.sessionId).toBe('sess-parent');
    });
  });

  describe('JSON output', () => {
    it('produces one parseable JSON object per log call', () => {
      const { logger, lines } = createTestLogger();
      logger.info('first');
      logger.warn('second');

      expect(lines).toHaveLength(2);
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });
  });
});
