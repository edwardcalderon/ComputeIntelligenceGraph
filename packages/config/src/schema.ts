import { z } from 'zod';

export const CigConfigSchema = z.object({
  neo4j: z.object({
    uri: z.string().min(1, 'neo4j.uri is required'),
    username: z.string().min(1, 'neo4j.username is required'),
    password: z.string().min(1, 'neo4j.password is required'),
    maxConnectionPoolSize: z.number().int().positive().default(50),
  }),
  api: z.object({
    port: z.number().int().min(1).max(65535).default(8080),
    host: z.string().default('0.0.0.0'),
    corsOrigins: z.array(z.string()).default(['*']),
    jwtSecret: z.string().optional(),
    apiKeySecret: z.string().optional(),
  }).default({}),
  discovery: z.object({
    intervalMinutes: z.number().int().positive().default(5),
    cartographyUrl: z.string().url().default('http://localhost:8001'),
  }).default({}),
  chatbot: z.object({
    openaiApiKey: z.string().optional(),
    chromaUrl: z.string().url().default('http://localhost:8000'),
    model: z.string().default('gpt-4o-mini'),
  }).default({}),
  aws: z.object({
    region: z.string().default('us-east-2'),
    roleArn: z.string().optional(),
  }).default({}),
  gcp: z.object({
    project: z.string().optional(),
    region: z.string().default('us-central1'),
    serviceAccountPath: z.string().optional(),
  }).default({}),
  observability: z.object({
    metricsEnabled: z.boolean().default(true),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }).default({}),
});

export type CigConfig = z.infer<typeof CigConfigSchema>;
