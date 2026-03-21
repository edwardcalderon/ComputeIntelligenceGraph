/**
 * Docker Compose Generator for CIG Installation
 *
 * Generates docker-compose.yml and .env files from InstallManifest.
 * Requirement 7: CLI Install Flow (Compose Generation)
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface InstallManifest {
  profile: 'core' | 'full';
  services: string[];
  env_overrides?: Record<string, string>;
  node_identity?: {
    target_id: string;
    private_key: string;
    public_key: string;
  };
  generated_secrets?: Record<string, string>;
}

interface ServiceConfig {
  image: string;
  ports?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
  healthcheck?: {
    test: string[];
    interval: string;
    timeout: string;
    retries: number;
  };
  depends_on?: Record<string, { condition: string }>;
}

interface ComposeConfig {
  version: string;
  services: Record<string, ServiceConfig>;
  volumes?: Record<string, Record<string, never>>;
}

/**
 * Generate a cryptographically random secret of specified length.
 * Uses crypto.randomBytes for secure random generation.
 */
function generateSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate environment variables for services.
 * Includes service-specific secrets and any overrides from manifest.
 */
function generateEnvVars(manifest: InstallManifest): Record<string, string> {
  const env: Record<string, string> = {};

  // Generate secrets for each service
  for (const service of manifest.services) {
    const secretKey = `${service.toUpperCase()}_SECRET`;
    env[secretKey] = generateSecret(32);
  }

  // Add node identity if present
  if (manifest.node_identity) {
    env['NODE_TARGET_ID'] = manifest.node_identity.target_id;
    env['NODE_PUBLIC_KEY'] = manifest.node_identity.public_key;
    env['NODE_PRIVATE_KEY'] = manifest.node_identity.private_key;
  }

  // Apply any environment overrides
  if (manifest.env_overrides) {
    Object.assign(env, manifest.env_overrides);
  }

  return env;
}

/**
 * Generate service configuration for docker-compose.yml.
 */
function generateServiceConfig(serviceName: string, profile: string): ServiceConfig {
  const configs: Record<string, Record<string, ServiceConfig>> = {
    core: {
      api: {
        image: 'cig/api:latest',
        ports: ['8000:8000'],
        environment: {
          PORT: '8000',
          LOG_LEVEL: 'info',
        },
        healthcheck: {
          test: ['CMD', 'curl', '-f', 'http://localhost:8000/health'],
          interval: '10s',
          timeout: '5s',
          retries: 3,
        },
      },
      neo4j: {
        image: 'neo4j:5.0',
        ports: ['7474:7474', '7687:7687'],
        environment: {
          NEO4J_AUTH: 'neo4j/password',
        },
        volumes: ['neo4j_data:/data'],
        healthcheck: {
          test: ['CMD', 'cypher-shell', '-u', 'neo4j', '-p', 'password', 'RETURN 1'],
          interval: '10s',
          timeout: '5s',
          retries: 3,
        },
      },
    },
    full: {
      dashboard: {
        image: 'cig/dashboard:latest',
        ports: ['3000:3000'],
        environment: {
          PORT: '3000',
        },
        healthcheck: {
          test: ['CMD', 'curl', '-f', 'http://localhost:3000/health'],
          interval: '10s',
          timeout: '5s',
          retries: 3,
        },
      },
      discovery: {
        image: 'cig/discovery:latest',
        ports: ['8080:8080'],
        environment: {
          PORT: '8080',
        },
        healthcheck: {
          test: ['CMD', 'curl', '-f', 'http://localhost:8080/health'],
          interval: '10s',
          timeout: '5s',
          retries: 3,
        },
      },
      cartography: {
        image: 'cig/cartography:latest',
        environment: {
          LOG_LEVEL: 'info',
        },
        depends_on: {
          neo4j: { condition: 'service_healthy' },
        },
      },
    },
  };

  // Return service config or a minimal default
  const profileConfigs = configs[profile] || {};
  return (
    profileConfigs[serviceName] || {
      image: `cig/${serviceName}:latest`,
      environment: {},
    }
  );
}

/**
 * Generate docker-compose.yml content.
 */
function generateComposeYml(manifest: InstallManifest): ComposeConfig {
  const services: Record<string, ServiceConfig> = {};
  const volumes: Record<string, Record<string, never>> = {};

  for (const service of manifest.services) {
    const config = generateServiceConfig(service, manifest.profile);
    services[service] = config;

    // Collect volume definitions
    if (config.volumes) {
      for (const volume of config.volumes) {
        const volumeName = volume.split(':')[0];
        if (!volumeName.includes('/')) {
          volumes[volumeName] = {};
        }
      }
    }
  }

  const compose: ComposeConfig = {
    version: '3.8',
    services,
  };

  if (Object.keys(volumes).length > 0) {
    compose.volumes = volumes;
  }

  return compose;
}

/**
 * Format environment variables as .env file content.
 */
function formatEnvFile(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

/**
 * Generate docker-compose.yml and .env files from InstallManifest.
 * Writes .env with permissions 0600 for security.
 */
export async function generateCompose(manifest: InstallManifest, outputDir: string): Promise<void> {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  }

  // Generate environment variables
  const envVars = generateEnvVars(manifest);

  // Generate docker-compose.yml
  const composeConfig = generateComposeYml(manifest);
  const composeYml = JSON.stringify(composeConfig, null, 2);

  // Write docker-compose.yml
  const composePath = path.join(outputDir, 'docker-compose.yml');
  fs.writeFileSync(composePath, composeYml, { mode: 0o644 });

  // Write .env with restricted permissions (0600)
  const envPath = path.join(outputDir, '.env');
  const envContent = formatEnvFile(envVars);
  fs.writeFileSync(envPath, envContent, { mode: 0o600 });
}
