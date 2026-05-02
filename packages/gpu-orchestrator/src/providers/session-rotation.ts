/**
 * Pure session rotation decision logic.
 *
 * Extracted from `ColabProvider.shouldRotate()` so it can be tested
 * independently without requiring a full provider instance or mocking
 * `Date.now()`.
 */

/** Session age threshold (ms) for proactive rotation — 11 hours. */
export const SESSION_ROTATION_THRESHOLD_MS = 39_600_000;

/**
 * Determine whether a session should be proactively rotated.
 *
 * Returns `true` if the difference between `currentTimeMs` and
 * `startTimeMs` exceeds 11 hours (39 600 000 ms).
 *
 * @param startTimeMs  - Session start time as epoch milliseconds.
 * @param currentTimeMs - Current time as epoch milliseconds.
 */
export function shouldRotateSession(
  startTimeMs: number,
  currentTimeMs: number,
): boolean {
  return currentTimeMs - startTimeMs > SESSION_ROTATION_THRESHOLD_MS;
}
