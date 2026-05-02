/**
 * Property 3: Configuration Round-Trip
 *
 * For any valid `OrchestratorConfig` object, serializing it to JSON via
 * `JSON.stringify()` and then parsing it back via the Zod `ConfigSchema.parse()`
 * SHALL produce a configuration object equivalent to the original.
 *
 * **Validates: Requirements 1.7, 9.1, 12.5**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ConfigSchema, type OrchestratorConfig } from '../config/schemas.js';
import { redactConfig } from '../config/loader.js';

/**
 * Arbitrary for a valid `OrchestratorConfig` object matching all schema
 * constraints. Each field is generated to satisfy the Zod validators.
 */
const arbOrchestratorConfig: fc.Arbitrary<OrchestratorConfig> = fc.record({
  provider: fc.constantFrom<'colab' | 'local'>('colab', 'local'),
  modelNames: fc
    .array(
      fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0 && !s.includes(',')),
      { minLength: 1, maxLength: 5 },
    ),
  googleCredentialsPath: fc.option(
    fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
    { nil: undefined },
  ),
  googleOAuthClientId: fc.option(
    fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
    { nil: undefined },
  ),
  googleOAuthClientSecret: fc.option(
    fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
    { nil: undefined },
  ),
  awsRegion: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  requestQueueUrl: fc.webUrl({ withFragments: false, withQueryParameters: false }),
  responseQueueUrl: fc.webUrl({ withFragments: false, withQueryParameters: false }),
  dynamoTableName: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  healthCheckIntervalMs: fc.integer({ min: 1, max: 600_000 }),
  healthEndpointPort: fc.integer({ min: 1, max: 65_535 }),
  heartbeatThresholdSeconds: fc.integer({ min: 1, max: 3600 }),
  logLevel: fc.constantFrom<'debug' | 'info' | 'warn' | 'error'>('debug', 'info', 'warn', 'error'),
});

describe('Property 3: Configuration Round-Trip', () => {
  it('serializing a valid OrchestratorConfig to JSON and parsing back via ConfigSchema.parse() produces an equivalent object', () => {
    fc.assert(
      fc.property(arbOrchestratorConfig, (config) => {
        // Step 1: Serialize the config to JSON
        const json = JSON.stringify(config);

        // Step 2: Parse the JSON back to a plain object
        const plainObject = JSON.parse(json);

        // The ConfigSchema expects `modelNames` as a comma-separated string
        // (it uses z.string().transform(s => s.split(','))), so we convert
        // the array back to the schema's input format for the round-trip.
        const schemaInput = {
          ...plainObject,
          modelNames: plainObject.modelNames.join(','),
        };

        // Step 3: Parse via ConfigSchema.parse()
        const result = ConfigSchema.parse(schemaInput);

        // Step 4: Assert deep equality with the original config
        expect(result).toEqual(config);
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 4: Configuration Validation Error Completeness
 *
 * For any configuration object with N distinct validation errors (missing
 * required fields, invalid types, out-of-range values), the Zod validation
 * SHALL report all N errors in the error output, not just the first one
 * encountered.
 *
 * **Validates: Requirements 9.2**
 */

describe('Property 4: Configuration Validation Error Completeness', () => {
  /** Required fields that, when omitted, each produce a distinct Zod error. */
  const REQUIRED_FIELDS = ['modelNames', 'requestQueueUrl', 'responseQueueUrl'] as const;

  /**
   * A valid base config that passes all Zod validation. Errors are introduced
   * by selectively omitting required fields or injecting invalid values.
   */
  const validBase: Record<string, unknown> = {
    provider: 'colab',
    modelNames: 'llama3',
    requestQueueUrl: 'https://sqs.us-east-2.amazonaws.com/123456789/req',
    responseQueueUrl: 'https://sqs.us-east-2.amazonaws.com/123456789/res',
    awsRegion: 'us-east-2',
    dynamoTableName: 'llm-proxy-state',
    healthCheckIntervalMs: 60000,
    healthEndpointPort: 8787,
    heartbeatThresholdSeconds: 180,
    logLevel: 'info',
  };

  /**
   * Arbitrary that generates a non-empty subset of required fields to omit,
   * plus optional invalid-value injections for enum and numeric fields.
   */
  const arbErrorConfig = fc
    .record({
      /** Non-empty subset of required fields to omit */
      fieldsToOmit: fc.subarray([...REQUIRED_FIELDS], { minLength: 0, maxLength: REQUIRED_FIELDS.length }),
      /** Whether to inject an invalid provider enum value */
      invalidProvider: fc.boolean(),
      /** Whether to inject an invalid logLevel enum value */
      invalidLogLevel: fc.boolean(),
      /** Whether to inject a negative healthCheckIntervalMs */
      negativeHealthInterval: fc.boolean(),
    })
    .filter(
      ({ fieldsToOmit, invalidProvider, invalidLogLevel, negativeHealthInterval }) =>
        // Ensure at least one error is introduced
        fieldsToOmit.length > 0 || invalidProvider || invalidLogLevel || negativeHealthInterval,
    );

  it('Zod reports at least as many issues as the number of distinct errors introduced', () => {
    fc.assert(
      fc.property(arbErrorConfig, ({ fieldsToOmit, invalidProvider, invalidLogLevel, negativeHealthInterval }) => {
        // Build a config starting from the valid base
        const config: Record<string, unknown> = { ...validBase };

        let expectedErrors = 0;

        // 1. Omit required fields
        for (const field of fieldsToOmit) {
          delete config[field];
          expectedErrors++;
        }

        // 2. Inject invalid provider enum value
        if (invalidProvider) {
          config.provider = 'invalid-provider-xyz';
          expectedErrors++;
        }

        // 3. Inject invalid logLevel enum value
        if (invalidLogLevel) {
          config.logLevel = 'not-a-log-level';
          expectedErrors++;
        }

        // 4. Inject negative healthCheckIntervalMs
        if (negativeHealthInterval) {
          config.healthCheckIntervalMs = -100;
          expectedErrors++;
        }

        // Parse with Zod — should fail
        const result = ConfigSchema.safeParse(config);

        // The config must be invalid
        expect(result.success).toBe(false);

        if (!result.success) {
          // Zod must report at least as many issues as the distinct errors we introduced
          expect(result.error.issues.length).toBeGreaterThanOrEqual(expectedErrors);
        }
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 5: Configuration Redaction
 *
 * For any valid `OrchestratorConfig` object, the `redactConfig()` function
 * SHALL return an object where: (a) fields named `googleCredentialsPath`,
 * `googleOAuthClientId`, and `googleOAuthClientSecret` have their values
 * replaced with `'***'`, and (b) all other fields retain their original
 * string representation.
 *
 * **Validates: Requirements 9.6**
 */

describe('Property 5: Configuration Redaction', () => {
  const SENSITIVE_KEYS = [
    'googleCredentialsPath',
    'googleOAuthClientId',
    'googleOAuthClientSecret',
  ] as const;

  it('redactConfig() replaces sensitive fields with "***" and preserves all other fields', () => {
    fc.assert(
      fc.property(arbOrchestratorConfig, (config) => {
        const redacted = redactConfig(config);

        // (a) Sensitive fields are always '***'
        for (const key of SENSITIVE_KEYS) {
          expect(redacted[key]).toBe('***');
        }

        // (b) All other fields retain their original string representation
        for (const [key, value] of Object.entries(config)) {
          if (SENSITIVE_KEYS.includes(key as (typeof SENSITIVE_KEYS)[number])) {
            continue;
          }

          if (Array.isArray(value)) {
            expect(redacted[key]).toBe(value.join(','));
          } else {
            expect(redacted[key]).toBe(String(value));
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
