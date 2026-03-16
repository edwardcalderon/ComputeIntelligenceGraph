/**
 * Property 7: Dependency Edge Labeling
 * Validates: Requirements 6.7
 *
 * For any relationship created between two resources, the relationship type
 * is preserved when queried.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { GraphEngine } from './engine';
import * as neo4j from './neo4j';
import { RelationshipType } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWriteSession(capturedParams: Record<string, unknown>[]) {
  return {
    run: vi.fn().mockImplementation((_query: string, params: Record<string, unknown>) => {
      capturedParams.push(params);
      return Promise.resolve({ records: [] });
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function makeReadSession(relType: string, fromId: string, toId: string) {
  return {
    run: vi.fn().mockResolvedValue({
      records: [
        {
          get: (key: string) => {
            const map: Record<string, string> = {
              id: `${fromId}:${relType}:${toId}`,
              type: relType,
              fromId,
              toId,
              properties: '{}',
            };
            return map[key];
          },
        },
      ],
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const resourceIdArb = fc.hexaString({ minLength: 4, maxLength: 12 });

const relationshipTypeArb = fc.constantFrom(
  RelationshipType.DEPENDS_ON,
  RelationshipType.CONNECTS_TO,
  RelationshipType.USES,
  RelationshipType.MEMBER_OF,
  RelationshipType.HAS_PERMISSION,
  RelationshipType.MOUNTS,
  RelationshipType.ROUTES_TO,
);

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 7: Dependency Edge Labeling', () => {
  let engine: GraphEngine;

  beforeEach(() => {
    engine = new GraphEngine();
    vi.restoreAllMocks();
  });

  it('relationship type is preserved in the Cypher query when creating a relationship', async () => {
    /**
     * Validates: Requirements 6.7
     * For any resource pair and relationship type, createRelationship() must
     * issue a Cypher query that embeds the exact relationship type label.
     */
    await fc.assert(
      fc.asyncProperty(resourceIdArb, resourceIdArb, relationshipTypeArb, async (fromId, toId, relType) => {
        const captured: Record<string, unknown>[] = [];
        const writeSession = makeWriteSession(captured);
        vi.spyOn(neo4j, 'getWriteSession').mockReturnValue(
          writeSession as unknown as ReturnType<typeof neo4j.getWriteSession>
        );

        await engine.createRelationship(fromId, toId, relType);

        // The session.run must have been called
        expect(writeSession.run).toHaveBeenCalledTimes(1);

        // The query string must contain the relationship type label
        const [query] = writeSession.run.mock.calls[0] as [string, ...unknown[]];
        expect(query).toContain(relType);

        // The params must include the correct from/to IDs
        const params = captured[0];
        expect(params['from']).toBe(fromId);
        expect(params['to']).toBe(toId);
      }),
      { numRuns: 50 }
    );
  });

  it('relationship type is returned unchanged when querying relationships', async () => {
    /**
     * Validates: Requirements 6.7
     * For any resource and relationship type, getRelationships() must return
     * the exact relationship type that was stored.
     */
    await fc.assert(
      fc.asyncProperty(resourceIdArb, resourceIdArb, relationshipTypeArb, async (fromId, toId, relType) => {
        const readSession = makeReadSession(relType, fromId, toId);
        vi.spyOn(neo4j, 'getReadSession').mockReturnValue(
          readSession as unknown as ReturnType<typeof neo4j.getReadSession>
        );

        const relationships = await engine.getRelationships(fromId);

        expect(relationships.length).toBeGreaterThanOrEqual(1);
        const rel = relationships[0];
        expect(rel.type).toBe(relType);
        expect(rel.fromId).toBe(fromId);
        expect(rel.toId).toBe(toId);
      }),
      { numRuns: 50 }
    );
  });

  it('relationship ID encodes from, type, and to — preserving all three', async () => {
    /**
     * Validates: Requirements 6.7
     * The relationship ID format `from:TYPE:to` encodes all three components,
     * ensuring the type label is never lost.
     */
    await fc.assert(
      fc.asyncProperty(resourceIdArb, resourceIdArb, relationshipTypeArb, async (fromId, toId, relType) => {
        const captured: Record<string, unknown>[] = [];
        const writeSession = makeWriteSession(captured);
        vi.spyOn(neo4j, 'getWriteSession').mockReturnValue(
          writeSession as unknown as ReturnType<typeof neo4j.getWriteSession>
        );

        await engine.createRelationship(fromId, toId, relType);

        const params = captured[0];
        const relId = params['relId'] as string;
        expect(relId).toBe(`${fromId}:${relType}:${toId}`);
        expect(relId).toContain(relType);
      }),
      { numRuns: 50 }
    );
  });
});
