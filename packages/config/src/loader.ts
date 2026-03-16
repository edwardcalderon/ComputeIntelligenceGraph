import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { ZodError } from 'zod';
import { CigConfigSchema, type CigConfig } from './schema';

/**
 * Maps environment variables to a partial CigConfig.
 */
export function loadFromEnv(): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  const neo4j: Record<string, unknown> = {};
  if (process.env['NEO4J_URI']) neo4j['uri'] = process.env['NEO4J_URI'];
  if (process.env['NEO4J_USER']) neo4j['username'] = process.env['NEO4J_USER'];
  if (process.env['NEO4J_PASSWORD']) neo4j['password'] = process.env['NEO4J_PASSWORD'];
  if (Object.keys(neo4j).length > 0) config['neo4j'] = neo4j;

  const api: Record<string, unknown> = {};
  if (process.env['API_PORT']) api['port'] = parseInt(process.env['API_PORT'], 10);
  if (process.env['API_HOST']) api['host'] = process.env['API_HOST'];
  if (Object.keys(api).length > 0) config['api'] = api;

  const discovery: Record<string, unknown> = {};
  if (process.env['DISCOVERY_INTERVAL_MINUTES'])
    discovery['intervalMinutes'] = parseInt(process.env['DISCOVERY_INTERVAL_MINUTES'], 10);
  if (process.env['CARTOGRAPHY_URL']) discovery['cartographyUrl'] = process.env['CARTOGRAPHY_URL'];
  if (Object.keys(discovery).length > 0) config['discovery'] = discovery;

  const chatbot: Record<string, unknown> = {};
  if (process.env['OPENAI_API_KEY']) chatbot['openaiApiKey'] = process.env['OPENAI_API_KEY'];
  if (process.env['CHROMA_URL']) chatbot['chromaUrl'] = process.env['CHROMA_URL'];
  if (Object.keys(chatbot).length > 0) config['chatbot'] = chatbot;

  const aws: Record<string, unknown> = {};
  if (process.env['AWS_REGION']) aws['region'] = process.env['AWS_REGION'];
  if (process.env['AWS_ROLE_ARN']) aws['roleArn'] = process.env['AWS_ROLE_ARN'];
  if (Object.keys(aws).length > 0) config['aws'] = aws;

  const gcp: Record<string, unknown> = {};
  if (process.env['GCP_PROJECT']) gcp['project'] = process.env['GCP_PROJECT'];
  if (Object.keys(gcp).length > 0) config['gcp'] = gcp;

  const observability: Record<string, unknown> = {};
  if (process.env['LOG_LEVEL']) observability['logLevel'] = process.env['LOG_LEVEL'];
  if (Object.keys(observability).length > 0) config['observability'] = observability;

  return config;
}

/**
 * Loads configuration from a YAML file.
 */
export function loadFromYaml(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(content);
  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid YAML config at ${filePath}: expected an object`);
  }
  return parsed as Record<string, unknown>;
}

/**
 * Deep merges two plain objects. Values from `override` take precedence.
 */
function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overrideVal = override[key];
    if (
      overrideVal !== null &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal) &&
      baseVal !== null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      );
    } else {
      result[key] = overrideVal;
    }
  }
  return result;
}

/**
 * Validates an unknown value against the CigConfigSchema.
 * Throws a descriptive error on failure.
 */
export function validateConfig(config: unknown): CigConfig {
  try {
    return CigConfigSchema.parse(config);
  } catch (err) {
    if (err instanceof ZodError) {
      const messages = err.errors
        .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
        .join('\n');
      throw new Error(`Invalid CIG configuration:\n${messages}`);
    }
    throw err;
  }
}

/**
 * Loads and merges configuration from defaults, YAML file, and environment variables.
 * Priority (highest to lowest): env vars > YAML file > schema defaults.
 */
export function loadConfig(yamlPath?: string): CigConfig {
  const yamlConfig = yamlPath ? loadFromYaml(yamlPath) : {};
  const envConfig = loadFromEnv();
  const merged = deepMerge(yamlConfig, envConfig);
  return validateConfig(merged);
}
