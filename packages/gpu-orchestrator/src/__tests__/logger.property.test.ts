import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Logger, type LogEntry, type LogLevel } from '../lib/logger.js';

/**
 * Property 11: Structured Log Entry Completeness
 *
 * For any log parameters (arbitrary level, component name, session ID, message,
 * and optional error details), the structured logger SHALL produce a JSON string
 * that, when parsed, contains all required fields: `timestamp` (valid ISO 8601),
 * `level`, `component`, `sessionId`, and `message`.
 *
 * **Validates: Requirements 10.1**
 */

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error', 'critical'];

/** Arbitrary for picking a log level. */
const arbLogLevel = fc.constantFrom<LogLevel>(...LOG_LEVELS);

/** Arbitrary for non-empty strings (component, sessionId, message). */
const arbNonEmptyString = fc.string({ minLength: 1, maxLength: 200 }).filter(
  (s) => s.trim().length > 0,
);

/** Arbitrary for an optional Error object. */
const arbOptionalError = fc.option(
  fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
    message: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
  }),
  { nil: undefined },
);

describe('Property 11: Structured Log Entry Completeness', () => {
  it('parsed log output contains all required fields with valid types for any log parameters', () => {
    fc.assert(
      fc.property(
        arbLogLevel,
        arbNonEmptyString,
        arbNonEmptyString,
        arbNonEmptyString,
        arbOptionalError,
        (level, component, sessionId, message, errorParams) => {
          const lines: string[] = [];
          const logger = new Logger({
            component,
            sessionId,
            writer: (line: string) => lines.push(line),
          });

          // Build an Error object if errorParams were generated
          const error = errorParams
            ? Object.assign(new Error(errorParams.message), { name: errorParams.name })
            : undefined;

          // Call the appropriate logger method
          logger[level](message, error);

          // Must have produced exactly one line
          expect(lines).toHaveLength(1);

          // Must be valid JSON
          const entry: LogEntry = JSON.parse(lines[0]);

          // --- Required field: timestamp (valid ISO 8601) ---
          expect(typeof entry.timestamp).toBe('string');
          const parsedDate = new Date(entry.timestamp);
          expect(parsedDate.toISOString()).toBe(entry.timestamp);

          // --- Required field: level (matches input) ---
          expect(entry.level).toBe(level);

          // --- Required field: component (matches input) ---
          expect(entry.component).toBe(component);

          // --- Required field: sessionId (matches input) ---
          expect(entry.sessionId).toBe(sessionId);

          // --- Required field: message (matches input) ---
          expect(entry.message).toBe(message);

          // --- Optional field: error (when provided, has name and message) ---
          if (errorParams) {
            expect(entry.error).toBeDefined();
            expect(typeof entry.error!.name).toBe('string');
            expect(typeof entry.error!.message).toBe('string');
            expect(entry.error!.name).toBe(errorParams.name);
            expect(entry.error!.message).toBe(errorParams.message);
          } else {
            expect(entry.error).toBeUndefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
