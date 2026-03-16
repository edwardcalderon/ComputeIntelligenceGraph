import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CigConfigSchema } from './schema';
import { loadFromEnv, loadFromYaml, loadConfig, validateConfig } from './loader';

// Helper to write a temp YAML file
function writeTempYaml(content: string): string {
  const file = path.join(os.tmpdir(), `cig-test-${Date.now()}.yaml`);
  fs.writeFileSync(file, content, 'utf-8');
  return file;
}

describe('CigConfigSchema', () => {
  it('parses a minimal valid config with required neo4j fields', () => {
    const result = CigConfigSchema.parse({
      neo4j: { uri: 'bolt://localhost:7687', username: 'neo4j', password: 'secret' },
    });
    expect(result.neo4j.uri).toBe('bolt://localhost:7687');
    expect(result.neo4j.maxConnectionPoolSize).toBe(50);
  });

  it('applies default values for optional sections', () => {
    const result = CigConfigSchema.parse({
      neo4j: { uri: 'bolt://localhost:7687', username: 'neo4j', password: 'secret' },
    });
    expect(result.api.port).toBe(8080);
    expect(result.api.host).toBe('0.0.0.0');
    expect(result.api.corsOrigins).toEqual(['*']);
    expect(result.discovery.intervalMinutes).toBe(5);
    expect(result.discovery.cartographyUrl).toBe('http://localhost:8001');
    expect(result.chatbot.chromaUrl).toBe('http://localhost:8000');
    expect(result.chatbot.model).toBe('gpt-4o-mini');
    expect(result.aws.region).toBe('us-east-1');
    expect(result.gcp.region).toBe('us-central1');
    expect(result.observability.metricsEnabled).toBe(true);
    expect(result.observability.logLevel).toBe('info');
  });

  it('rejects config missing neo4j.uri', () => {
    expect(() =>
      CigConfigSchema.parse({ neo4j: { username: 'neo4j', password: 'secret' } }),
    ).toThrow();
  });

  it('rejects invalid logLevel', () => {
    expect(() =>
      CigConfigSchema.parse({
        neo4j: { uri: 'bolt://localhost:7687', username: 'neo4j', password: 'secret' },
        observability: { logLevel: 'verbose' },
      }),
    ).toThrow();
  });
});

describe('loadFromEnv', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('returns empty object when no relevant env vars are set', () => {
    // Remove relevant vars
    delete process.env['NEO4J_URI'];
    delete process.env['NEO4J_USER'];
    delete process.env['NEO4J_PASSWORD'];
    delete process.env['API_PORT'];
    delete process.env['API_HOST'];
    delete process.env['DISCOVERY_INTERVAL_MINUTES'];
    delete process.env['CARTOGRAPHY_URL'];
    delete process.env['OPENAI_API_KEY'];
    delete process.env['CHROMA_URL'];
    delete process.env['AWS_REGION'];
    delete process.env['AWS_ROLE_ARN'];
    delete process.env['GCP_PROJECT'];
    delete process.env['LOG_LEVEL'];
    const result = loadFromEnv();
    expect(result).toEqual({});
  });

  it('maps NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD', () => {
    process.env['NEO4J_URI'] = 'bolt://db:7687';
    process.env['NEO4J_USER'] = 'admin';
    process.env['NEO4J_PASSWORD'] = 'pass123';
    const result = loadFromEnv();
    expect((result['neo4j'] as Record<string, unknown>)['uri']).toBe('bolt://db:7687');
    expect((result['neo4j'] as Record<string, unknown>)['username']).toBe('admin');
    expect((result['neo4j'] as Record<string, unknown>)['password']).toBe('pass123');
  });

  it('parses API_PORT as a number', () => {
    process.env['API_PORT'] = '9090';
    const result = loadFromEnv();
    expect((result['api'] as Record<string, unknown>)['port']).toBe(9090);
  });

  it('maps DISCOVERY_INTERVAL_MINUTES as a number', () => {
    process.env['DISCOVERY_INTERVAL_MINUTES'] = '10';
    const result = loadFromEnv();
    expect((result['discovery'] as Record<string, unknown>)['intervalMinutes']).toBe(10);
  });

  it('maps LOG_LEVEL to observability.logLevel', () => {
    process.env['LOG_LEVEL'] = 'debug';
    const result = loadFromEnv();
    expect((result['observability'] as Record<string, unknown>)['logLevel']).toBe('debug');
  });
});

describe('loadFromYaml', () => {
  it('returns empty object for non-existent file', () => {
    expect(loadFromYaml('/tmp/does-not-exist-cig.yaml')).toEqual({});
  });

  it('parses a valid YAML file', () => {
    const file = writeTempYaml(`
neo4j:
  uri: bolt://yaml-host:7687
  username: yamluser
  password: yamlpass
api:
  port: 9000
`);
    try {
      const result = loadFromYaml(file);
      expect((result['neo4j'] as Record<string, unknown>)['uri']).toBe('bolt://yaml-host:7687');
      expect((result['api'] as Record<string, unknown>)['port']).toBe(9000);
    } finally {
      fs.unlinkSync(file);
    }
  });

  it('throws on invalid YAML structure (array at root)', () => {
    const file = writeTempYaml('- item1\n- item2\n');
    try {
      expect(() => loadFromYaml(file)).toThrow();
    } finally {
      fs.unlinkSync(file);
    }
  });
});

describe('validateConfig', () => {
  it('returns a valid CigConfig for correct input', () => {
    const config = validateConfig({
      neo4j: { uri: 'bolt://localhost:7687', username: 'neo4j', password: 'secret' },
    });
    expect(config.neo4j.uri).toBe('bolt://localhost:7687');
  });

  it('throws a descriptive error for invalid config', () => {
    expect(() => validateConfig({ neo4j: {} })).toThrow('Invalid CIG configuration');
  });
});

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('loads config from YAML file', () => {
    const file = writeTempYaml(`
neo4j:
  uri: bolt://yaml:7687
  username: u
  password: p
`);
    try {
      const config = loadConfig(file);
      expect(config.neo4j.uri).toBe('bolt://yaml:7687');
    } finally {
      fs.unlinkSync(file);
    }
  });

  it('env vars override YAML values', () => {
    const file = writeTempYaml(`
neo4j:
  uri: bolt://yaml:7687
  username: u
  password: p
api:
  port: 7000
`);
    process.env['API_PORT'] = '9999';
    try {
      const config = loadConfig(file);
      expect(config.api.port).toBe(9999);
    } finally {
      fs.unlinkSync(file);
      delete process.env['API_PORT'];
    }
  });

  it('throws descriptive error when required fields are missing', () => {
    expect(() => loadConfig()).toThrow('Invalid CIG configuration');
  });

  it('applies schema defaults when no YAML or env vars provided', () => {
    // Provide only required fields via env
    process.env['NEO4J_URI'] = 'bolt://localhost:7687';
    process.env['NEO4J_USER'] = 'neo4j';
    process.env['NEO4J_PASSWORD'] = 'secret';
    const config = loadConfig();
    expect(config.api.port).toBe(8080);
    expect(config.discovery.intervalMinutes).toBe(5);
    delete process.env['NEO4J_URI'];
    delete process.env['NEO4J_USER'];
    delete process.env['NEO4J_PASSWORD'];
  });
});
