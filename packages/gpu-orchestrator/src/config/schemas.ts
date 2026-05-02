/**
 * Zod schemas for GPU Orchestrator configuration.
 *
 * Defines the `ConfigSchema` that validates all `GPU_ORCH_*` environment
 * variable values after prefix stripping and key mapping.
 *
 * @module
 */

import { z } from 'zod';

/**
 * Zod schema for the orchestrator configuration.
 *
 * Each field corresponds to a `GPU_ORCH_*` environment variable after
 * the prefix is stripped and the key is mapped to camelCase.
 */
export const ConfigSchema = z.object({
  provider: z.enum(['colab', 'local']).default('colab'),
  modelNames: z
    .string()
    .transform((s) => s.split(','))
    .pipe(z.array(z.string().min(1)).min(1)),
  googleCredentialsPath: z.string().optional(),
  googleOAuthClientId: z.string().optional(),
  googleOAuthClientSecret: z.string().optional(),
  awsRegion: z.string().default('us-east-2'),
  requestQueueUrl: z.string().url(),
  responseQueueUrl: z.string().url(),
  dynamoTableName: z.string().default('llm-proxy-state'),
  healthCheckIntervalMs: z.coerce.number().int().positive().default(60_000),
  healthEndpointPort: z.coerce.number().int().positive().default(8787),
  heartbeatThresholdSeconds: z.coerce
    .number()
    .int()
    .positive()
    .default(180),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

/** Typed configuration object inferred from the Zod schema. */
export type OrchestratorConfig = z.infer<typeof ConfigSchema>;

/**
 * Mapping from `GPU_ORCH_*` environment variable suffixes (after stripping
 * the `GPU_ORCH_` prefix) to the corresponding `ConfigSchema` field names.
 */
export const ENV_KEY_MAP: Record<string, keyof z.input<typeof ConfigSchema>> = {
  PROVIDER: 'provider',
  MODEL_NAMES: 'modelNames',
  GOOGLE_CREDS_PATH: 'googleCredentialsPath',
  GOOGLE_CLIENT_ID: 'googleOAuthClientId',
  GOOGLE_CLIENT_SECRET: 'googleOAuthClientSecret',
  AWS_REGION: 'awsRegion',
  REQUEST_QUEUE_URL: 'requestQueueUrl',
  RESPONSE_QUEUE_URL: 'responseQueueUrl',
  DYNAMO_TABLE: 'dynamoTableName',
  HEALTH_INTERVAL: 'healthCheckIntervalMs',
  HEALTH_PORT: 'healthEndpointPort',
  HEARTBEAT_THRESHOLD: 'heartbeatThresholdSeconds',
  LOG_LEVEL: 'logLevel',
};

/** Fields whose values must be redacted when logging configuration. */
export const SENSITIVE_FIELDS: ReadonlyArray<keyof OrchestratorConfig> = [
  'googleCredentialsPath',
  'googleOAuthClientId',
  'googleOAuthClientSecret',
];
