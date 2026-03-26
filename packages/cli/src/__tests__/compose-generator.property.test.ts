/**
 * Property-Based Tests for Compose Generator
 *
 * Property 13: Compose generation completeness
 * Property 14: Generated secrets uniqueness
 *
 * Validates: Requirements 7.7, 7.8, 6.2, 6.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateCompose, InstallManifest } from '../compose-generator.js';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates a valid service name (lowercase alphanumeric, excluding reserved words).
 */
const reservedWords = new Set(['constructor', 'prototype', '__proto__', 'toString', 'valueOf']);
const serviceNameArb = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
    minLength: 3,
    maxLength: 20,
  })
  .filter((name) => !reservedWords.has(name));

/**
 * Generates a valid InstallManifest.
 */
const installManifestArb = fc
  .tuple(
    fc.constantFrom('discovery', 'full'),
    fc.uniqueArray(serviceNameArb, { minLength: 1, maxLength: 5 })
  )
  .map(([profile, services]) => ({
    profile: profile as 'discovery' | 'full',
    services,
    env_overrides: {},
  }))
  .filter((manifest) => manifest.services.length > 0);

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 13: Compose generation completeness', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cig-compose-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('generated docker-compose.yml includes all services from manifest', async () => {
    /**
     * Validates: Requirements 7.7, 6.2, 6.3
     *
     * For any valid InstallManifest with profile 'discovery' or 'full',
     * the generated docker-compose.yml should contain a service entry
     * for every service listed in the manifest's services array.
     */
    await fc.assert(
      fc.asyncProperty(installManifestArb, async (manifest) => {
        const outputDir = fs.mkdtempSync(path.join(tmpDir, 'test-'));

        try {
          await generateCompose(manifest, outputDir);

          // Read the generated docker-compose.yml
          const composePath = path.join(outputDir, 'docker-compose.yml');
          expect(fs.existsSync(composePath)).toBe(true);

          const composeContent = fs.readFileSync(composePath, 'utf-8');
          const composeData = JSON.parse(composeContent);

          // Verify all services from manifest are in the compose file
          for (const service of manifest.services) {
            expect(composeData.services).toHaveProperty(service);
          }

          // Verify no extra services are added
          const composeServices = Object.keys(composeData.services);
          expect(composeServices.length).toBe(manifest.services.length);
        } finally {
          fs.rmSync(outputDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 }
    );
  });

  it('generated docker-compose.yml has valid structure', async () => {
    /**
     * Validates: Requirements 7.7
     *
     * The generated docker-compose.yml should have a valid structure
     * with version and services fields.
     */
    await fc.assert(
      fc.asyncProperty(installManifestArb, async (manifest) => {
        const outputDir = fs.mkdtempSync(path.join(tmpDir, 'test-'));

        try {
          await generateCompose(manifest, outputDir);

          const composePath = path.join(outputDir, 'docker-compose.yml');
          const composeContent = fs.readFileSync(composePath, 'utf-8');
          const composeData = JSON.parse(composeContent);

          // Verify structure
          expect(composeData).toHaveProperty('version');
          expect(composeData).toHaveProperty('services');
          expect(typeof composeData.version).toBe('string');
          expect(typeof composeData.services).toBe('object');
        } finally {
          fs.rmSync(outputDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 }
    );
  });

  it('each service in compose has required fields', async () => {
    /**
     * Validates: Requirements 6.2, 6.3
     *
     * Each service in the generated docker-compose.yml should have
     * an image field and environment field.
     */
    await fc.assert(
      fc.asyncProperty(installManifestArb, async (manifest) => {
        const outputDir = fs.mkdtempSync(path.join(tmpDir, 'test-'));

        try {
          await generateCompose(manifest, outputDir);

          const composePath = path.join(outputDir, 'docker-compose.yml');
          const composeContent = fs.readFileSync(composePath, 'utf-8');
          const composeData = JSON.parse(composeContent);

          // Verify each service has required fields
          for (const service of manifest.services) {
            const serviceConfig = composeData.services[service];
            expect(serviceConfig).toHaveProperty('image');
            expect(typeof serviceConfig.image).toBe('string');
            expect(serviceConfig.image.length).toBeGreaterThan(0);
          }
        } finally {
          fs.rmSync(outputDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('Pinned service image refs', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cig-compose-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('uses pinned image refs when the manifest provides them', async () => {
    const manifest: InstallManifest = {
      profile: 'discovery',
      services: ['api', 'dashboard', 'neo4j', 'discovery', 'cartography'],
      service_images: {
        api: 'docker.io/cigtechnology/cig-api@sha256:1111111111111111111111111111111111111111111111111111111111111111',
        dashboard: 'docker.io/cigtechnology/cig-dashboard@sha256:2222222222222222222222222222222222222222222222222222222222222222',
        discovery: 'docker.io/cigtechnology/cig-discovery@sha256:3333333333333333333333333333333333333333333333333333333333333333',
        cartography: 'docker.io/cigtechnology/cig-cartography@sha256:4444444444444444444444444444444444444444444444444444444444444444',
      },
    };

    const outputDir = fs.mkdtempSync(path.join(tmpDir, 'test-'));
    try {
      await generateCompose(manifest, outputDir);

      const composePath = path.join(outputDir, 'docker-compose.yml');
      const composeData = JSON.parse(fs.readFileSync(composePath, 'utf-8')) as {
        services: Record<string, { image: string }>;
      };
      const serviceImages = manifest.service_images as Record<string, string>;

      expect(composeData.services.api.image).toBe(serviceImages.api);
      expect(composeData.services.dashboard.image).toBe(serviceImages.dashboard);
      expect(composeData.services.discovery.image).toBe(serviceImages.discovery);
      expect(composeData.services.cartography.image).toBe(serviceImages.cartography);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('defaults to the cigtechnology registry when no manifest images are provided', async () => {
    const manifest: InstallManifest = {
      profile: 'discovery',
      services: ['api', 'dashboard', 'neo4j', 'discovery', 'cartography'],
    };

    const outputDir = fs.mkdtempSync(path.join(tmpDir, 'test-'));
    try {
      await generateCompose(manifest, outputDir);

      const composePath = path.join(outputDir, 'docker-compose.yml');
      const composeData = JSON.parse(fs.readFileSync(composePath, 'utf-8')) as {
        services: Record<string, { image: string }>;
      };

      expect(composeData.services.api.image).toBe('docker.io/cigtechnology/cig-api:latest');
      expect(composeData.services.dashboard.image).toBe('docker.io/cigtechnology/cig-dashboard:latest');
      expect(composeData.services.discovery.image).toBe('docker.io/cigtechnology/cig-discovery:latest');
      expect(composeData.services.cartography.image).toBe('docker.io/cigtechnology/cig-cartography:latest');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('includes chatbot in the full bundle when requested', async () => {
    const manifest: InstallManifest = {
      profile: 'full',
      services: ['api', 'dashboard', 'neo4j', 'discovery', 'cartography', 'chatbot'],
      service_images: {
        api: 'docker.io/cigtechnology/cig-api@sha256:1111111111111111111111111111111111111111111111111111111111111111',
        dashboard: 'docker.io/cigtechnology/cig-dashboard@sha256:2222222222222222222222222222222222222222222222222222222222222222',
        discovery: 'docker.io/cigtechnology/cig-discovery@sha256:3333333333333333333333333333333333333333333333333333333333333333',
        cartography: 'docker.io/cigtechnology/cig-cartography@sha256:4444444444444444444444444444444444444444444444444444444444444444',
        chatbot: 'docker.io/cigtechnology/cig-chatbot@sha256:5555555555555555555555555555555555555555555555555555555555555555',
      },
    };

    const outputDir = fs.mkdtempSync(path.join(tmpDir, 'test-'));
    try {
      await generateCompose(manifest, outputDir);

      const composePath = path.join(outputDir, 'docker-compose.yml');
      const composeData = JSON.parse(fs.readFileSync(composePath, 'utf-8')) as {
        services: Record<string, { image: string }>;
      };
      const serviceImages = manifest.service_images as Record<string, string>;

      expect(composeData.services.chatbot.image).toBe(serviceImages.chatbot);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

describe('Property 14: Generated secrets uniqueness', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cig-compose-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('generated secrets are unique across multiple generations', async () => {
    /**
     * Validates: Requirements 7.8
     *
     * For any two independent calls to generateCompose with the same manifest,
     * the returned secrets should be distinct (collision probability negligible
     * with 256-bit entropy).
     */
    await fc.assert(
      fc.asyncProperty(installManifestArb, async (manifest) => {
        const outputDir1 = fs.mkdtempSync(path.join(tmpDir, 'test1-'));
        const outputDir2 = fs.mkdtempSync(path.join(tmpDir, 'test2-'));

        try {
          // Generate compose twice
          await generateCompose(manifest, outputDir1);
          await generateCompose(manifest, outputDir2);

          // Read both .env files
          const env1Content = fs.readFileSync(path.join(outputDir1, '.env'), 'utf-8');
          const env2Content = fs.readFileSync(path.join(outputDir2, '.env'), 'utf-8');

          // Parse environment variables
          const parseEnv = (content: string): Record<string, string> => {
            const env: Record<string, string> = {};
            for (const line of content.split('\n')) {
              if (line.trim() && !line.startsWith('#')) {
                const [key, value] = line.split('=');
                if (key && value) {
                  env[key] = value;
                }
              }
            }
            return env;
          };

          const env1 = parseEnv(env1Content);
          const env2 = parseEnv(env2Content);

          // Verify secrets are different
          for (const service of manifest.services) {
            const secretKey = `${service.toUpperCase()}_SECRET`;
            if (env1[secretKey] && env2[secretKey]) {
              expect(env1[secretKey]).not.toBe(env2[secretKey]);
            }
          }
        } finally {
          fs.rmSync(outputDir1, { recursive: true, force: true });
          fs.rmSync(outputDir2, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 }
    );
  });

  it('generated secrets have sufficient entropy', async () => {
    /**
     * Validates: Requirements 7.8
     *
     * Generated secrets should be 64 characters long (32 bytes in hex),
     * indicating 256-bit entropy.
     */
    await fc.assert(
      fc.asyncProperty(installManifestArb, async (manifest) => {
        const outputDir = fs.mkdtempSync(path.join(tmpDir, 'test-'));

        try {
          await generateCompose(manifest, outputDir);

          const envContent = fs.readFileSync(path.join(outputDir, '.env'), 'utf-8');

          // Parse environment variables
          const parseEnv = (content: string): Record<string, string> => {
            const env: Record<string, string> = {};
            for (const line of content.split('\n')) {
              if (line.trim() && !line.startsWith('#')) {
                const [key, value] = line.split('=');
                if (key && value) {
                  env[key] = value;
                }
              }
            }
            return env;
          };

          const env = parseEnv(envContent);

          // Verify each service secret has 64 hex characters (256-bit entropy)
          for (const service of manifest.services) {
            const secretKey = `${service.toUpperCase()}_SECRET`;
            const secret = env[secretKey];
            expect(secret).toBeDefined();
            expect(secret).toMatch(/^[0-9a-f]{64}$/);
          }
        } finally {
          fs.rmSync(outputDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 }
    );
  });

  it('.env file is written with restricted permissions (0600)', async () => {
    /**
     * Validates: Requirements 7.8
     *
     * The generated .env file should be written with permissions 0600
     * to restrict access to the owner only.
     */
    await fc.assert(
      fc.asyncProperty(installManifestArb, async (manifest) => {
        const outputDir = fs.mkdtempSync(path.join(tmpDir, 'test-'));

        try {
          await generateCompose(manifest, outputDir);

          const envPath = path.join(outputDir, '.env');
          const stats = fs.statSync(envPath);

          // Check permissions: 0600 = 384 in decimal
          // On Unix systems, mode & 0o777 gives the permission bits
          const permissions = stats.mode & 0o777;
          expect(permissions).toBe(0o600);
        } finally {
          fs.rmSync(outputDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 }
    );
  });
});
