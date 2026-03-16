/**
 * Property 29: Configuration Validation on Startup
 * Validates: Requirements 20.5, 20.6
 *
 * For any config with a missing required field, validateConfig() throws an error.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateConfig } from './loader';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A valid base config with all required fields present. */
const validBase = {
  neo4j: {
    uri: 'bolt://localhost:7687',
    username: 'neo4j',
    password: 'secret',
  },
};

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** The three required neo4j fields. */
const requiredNeo4jFieldArb = fc.constantFrom('uri' as const, 'username' as const, 'password' as const);

/** Generates a valid non-empty string value. */
const validStringArb = fc.string({ minLength: 1, maxLength: 50 });

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 29: Configuration Validation on Startup', () => {
  it('validateConfig() throws when a required neo4j field is missing', () => {
    /**
     * Validates: Requirements 20.5, 20.6
     * For any config missing one of the required neo4j fields (uri, username,
     * password), validateConfig() must throw an error.
     */
    fc.assert(
      fc.property(requiredNeo4jFieldArb, (missingField) => {
        const config = {
          neo4j: { ...validBase.neo4j, [missingField]: undefined },
        };
        // Remove the field entirely
        delete (config.neo4j as Record<string, unknown>)[missingField];

        expect(() => validateConfig(config)).toThrow();
      }),
      { numRuns: 30 }
    );
  });

  it('validateConfig() throws when neo4j required fields are empty strings', () => {
    /**
     * Validates: Requirements 20.5, 20.6
     * Required string fields must not be empty — validateConfig() must throw
     * for any config where a required field is an empty string.
     */
    fc.assert(
      fc.property(requiredNeo4jFieldArb, (emptyField) => {
        const config = {
          neo4j: { ...validBase.neo4j, [emptyField]: '' },
        };

        expect(() => validateConfig(config)).toThrow();
      }),
      { numRuns: 30 }
    );
  });

  it('validateConfig() succeeds for any config with all required fields present', () => {
    /**
     * Validates: Requirements 20.5
     * For any config that provides all required fields with valid values,
     * validateConfig() must not throw.
     */
    fc.assert(
      fc.property(validStringArb, validStringArb, validStringArb, (uri, username, password) => {
        const config = { neo4j: { uri, username, password } };
        expect(() => validateConfig(config)).not.toThrow();
      }),
      { numRuns: 50 }
    );
  });

  it('validateConfig() throws when the entire neo4j section is missing', () => {
    /**
     * Validates: Requirements 20.6
     * A config without the neo4j section entirely must fail validation.
     */
    fc.assert(
      fc.property(fc.record({ someOtherField: fc.string() }), (partialConfig) => {
        expect(() => validateConfig(partialConfig)).toThrow();
      }),
      { numRuns: 30 }
    );
  });
});
