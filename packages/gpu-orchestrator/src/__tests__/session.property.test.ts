/**
 * Property 10: Session Rotation Decision
 *
 * For any session start time and current time, the session rotation check
 * SHALL return `true` if and only if the difference between current time
 * and start time exceeds 11 hours (39 600 000 milliseconds).
 *
 * **Validates: Requirements 2.7**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  shouldRotateSession,
  SESSION_ROTATION_THRESHOLD_MS,
} from '../providers/session-rotation.js';

describe('Property 10: Session Rotation Decision', () => {
  it('shouldRotateSession returns true iff currentTime - startTime > 39600000 ms (11 hours)', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary start timestamps (epoch ms) in a realistic range
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER - SESSION_ROTATION_THRESHOLD_MS - 1 }),
        // Generate a non-negative offset so that currentTime >= startTime
        fc.integer({ min: 0, max: 2 * SESSION_ROTATION_THRESHOLD_MS }),
        (startTimeMs, offset) => {
          const currentTimeMs = startTimeMs + offset;
          const difference = currentTimeMs - startTimeMs;

          const expected = difference > SESSION_ROTATION_THRESHOLD_MS;
          const actual = shouldRotateSession(startTimeMs, currentTimeMs);

          expect(actual).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns false at exactly the 11-hour boundary (not strictly exceeded)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER - SESSION_ROTATION_THRESHOLD_MS - 1 }),
        (startTimeMs) => {
          // Exactly at the threshold — should NOT rotate (> not >=)
          const currentTimeMs = startTimeMs + SESSION_ROTATION_THRESHOLD_MS;
          expect(shouldRotateSession(startTimeMs, currentTimeMs)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns true one millisecond past the 11-hour boundary', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER - SESSION_ROTATION_THRESHOLD_MS - 2 }),
        (startTimeMs) => {
          // One ms past the threshold — should rotate
          const currentTimeMs = startTimeMs + SESSION_ROTATION_THRESHOLD_MS + 1;
          expect(shouldRotateSession(startTimeMs, currentTimeMs)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns false when currentTime equals startTime (zero elapsed)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        (startTimeMs) => {
          expect(shouldRotateSession(startTimeMs, startTimeMs)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
