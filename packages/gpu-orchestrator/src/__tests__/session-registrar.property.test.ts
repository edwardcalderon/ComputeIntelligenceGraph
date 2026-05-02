/**
 * Property 6: Orchestrator Record Completeness and TTL
 *
 * For any valid session data (arbitrary session ID, provider name, model list,
 * and timestamp), the `SessionRegistrar.buildRecord()` function SHALL produce
 * a DynamoDB item containing all required fields (`PK`, `SK`, `sessionId`,
 * `provider`, `models`, `createdAt`, `lastVerifiedAt`, `ttl`), and the `ttl`
 * value SHALL equal the floor of the creation timestamp in epoch seconds plus
 * exactly 86400.
 *
 * **Validates: Requirements 6.1, 6.5**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SessionRegistrar } from '../state/session-registrar.js';
import type { OrchestratorRecord } from '../state/session-registrar.js';

/**
 * Arbitrary for a valid ISO 8601 timestamp string.
 *
 * Generates a Date within a reasonable range and converts to ISO string.
 */
const arbIsoTimestamp: fc.Arbitrary<string> = fc
  .date({
    min: new Date('2020-01-01T00:00:00.000Z'),
    max: new Date('2030-12-31T23:59:59.999Z'),
  })
  .map((d) => d.toISOString());

/**
 * Arbitrary for a valid `OrchestratorRecord` object.
 *
 * - sessionId: UUID-like non-empty string
 * - provider: 'colab' | 'local'
 * - models: non-empty array of non-empty model name strings
 * - createdAt: valid ISO 8601 timestamp
 * - lastVerifiedAt: valid ISO 8601 timestamp
 * - ttl: positive integer (will be overridden by buildRecord)
 */
const arbOrchestratorRecord: fc.Arbitrary<OrchestratorRecord> = fc.record({
  sessionId: fc.uuid(),
  provider: fc.constantFrom('colab', 'local'),
  models: fc
    .array(
      fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,49}$/).filter(
        (s) => s.length > 0,
      ),
      { minLength: 1, maxLength: 5 },
    ),
  createdAt: arbIsoTimestamp,
  lastVerifiedAt: arbIsoTimestamp,
  ttl: fc.nat({ max: 2_000_000_000 }).filter((n) => n > 0),
});

describe('Property 6: Orchestrator Record Completeness and TTL', () => {
  it('buildRecord() produces a DynamoDB item with all required fields and correct TTL', () => {
    fc.assert(
      fc.property(arbOrchestratorRecord, (record) => {
        const item = SessionRegistrar.buildRecord(record);

        // Assert: all required fields are present
        expect(item).toHaveProperty('PK');
        expect(item).toHaveProperty('SK');
        expect(item).toHaveProperty('sessionId');
        expect(item).toHaveProperty('provider');
        expect(item).toHaveProperty('models');
        expect(item).toHaveProperty('createdAt');
        expect(item).toHaveProperty('lastVerifiedAt');
        expect(item).toHaveProperty('ttl');

        // Assert: PK === `ORCHESTRATOR#${sessionId}`
        expect(item['PK']).toBe(`ORCHESTRATOR#${record.sessionId}`);

        // Assert: SK === 'META'
        expect(item['SK']).toBe('META');

        // Assert: sessionId, provider, models, createdAt, lastVerifiedAt match input
        expect(item['sessionId']).toBe(record.sessionId);
        expect(item['provider']).toBe(record.provider);
        expect(item['models']).toEqual(record.models);
        expect(item['createdAt']).toBe(record.createdAt);
        expect(item['lastVerifiedAt']).toBe(record.lastVerifiedAt);

        // Assert: ttl === floor(createdAt epoch seconds) + 86400
        const expectedTtl =
          Math.floor(Date.parse(record.createdAt) / 1000) + 86400;
        expect(item['ttl']).toBe(expectedTtl);
      }),
      { numRuns: 100 },
    );
  });
});
