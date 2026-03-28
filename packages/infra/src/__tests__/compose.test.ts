/**
 * Unit tests for packages/infra/src/compose.ts
 *
 * Tests generateComposeFile and generateEnvFile.
 * Requirements: 5.9, 6.1, 6.2
 */

import { describe, it, expect } from 'vitest';
import { generateComposeFile, generateEnvFile } from '../compose.js';
import type { SetupManifest, NodeIdentity } from '../compose.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_MANIFEST: SetupManifest = {
  version: '1.0',
  cloudProvider: 'aws',
  credentialsRef: 'arn:aws:iam::123456789012:role/CIGRole',
  enrollmentToken: 'tok-uuid-1234',
  nodeIdentitySeed: 'seed-fingerprint',
  installProfile: 'core',
  targetMode: 'local',
  controlPlaneEndpoint: 'https://api.cig.lat',
  awsConfig: {
    roleArn: 'arn:aws:iam::123456789012:role/CIGRole',
    externalId: 'ext-id-abc',
    region: 'us-east-1',
  },
  signature: 'sig-abc',
  issuedAt: '2024-01-01T00:00:00Z',
  expiresAt: '2024-01-01T00:15:00Z',
};

const GCP_MANIFEST: SetupManifest = {
  ...BASE_MANIFEST,
  cloudProvider: 'gcp',
  credentialsRef: 'my-sa@my-project.iam.gserviceaccount.com',
  awsConfig: undefined,
  gcpConfig: {
    projectId: 'my-project',
    serviceAccountEmail: 'my-sa@my-project.iam.gserviceaccount.com',
    impersonationEnabled: true,
  },
};

const SELF_HOSTED_MANIFEST: SetupManifest = {
  ...BASE_MANIFEST,
  targetMode: 'host',
  controlPlaneEndpoint: 'http://localhost:3003',
};

const SELF_HOSTED_DEMO_MANIFEST: SetupManifest = {
  ...SELF_HOSTED_MANIFEST,
  isDemo: true,
};

const NODE_IDENTITY: NodeIdentity = {
  nodeId: 'node-uuid-5678',
  privateKey: 'priv-key-base64',
  publicKey: 'pub-key-base64',
  issuedAt: '2024-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// generateComposeFile — core profile
// ---------------------------------------------------------------------------

describe('generateComposeFile — core profile', () => {
  it('includes all core services', () => {
    const yaml = generateComposeFile(BASE_MANIFEST, 'core');
    expect(yaml).toContain('node-runtime:');
    expect(yaml).toContain('discovery-worker:');
    expect(yaml).toContain('cartography:');
    expect(yaml).toContain('graph-writer:');
    expect(yaml).toContain('neo4j:');
  });

  it('does NOT include full-profile services', () => {
    const yaml = generateComposeFile(BASE_MANIFEST, 'core');
    expect(yaml).not.toContain('chatbot:');
    expect(yaml).not.toContain('chroma:');
    expect(yaml).not.toContain('agents:');
  });

  it('does NOT include self-hosted services for local target', () => {
    const yaml = generateComposeFile(BASE_MANIFEST, 'core');
    expect(yaml).not.toContain('  api:');
    expect(yaml).not.toContain('  dashboard:');
  });

  it('omits the obsolete compose version field', () => {
    const yaml = generateComposeFile(BASE_MANIFEST, 'core');
    expect(yaml).not.toContain("version: '3.8'");
  });

  it('includes neo4j-data volume', () => {
    const yaml = generateComposeFile(BASE_MANIFEST, 'core');
    expect(yaml).toContain('neo4j-data:');
  });

  it('references expected env var placeholders', () => {
    const yaml = generateComposeFile(BASE_MANIFEST, 'core');
    expect(yaml).toContain('${CIG_NODE_ID}');
    expect(yaml).toContain('${CIG_CONTROL_PLANE_ENDPOINT}');
    expect(yaml).toContain('${CIG_CLOUD_PROVIDER}');
    expect(yaml).toContain('${NEO4J_PASSWORD}');
  });
});

// ---------------------------------------------------------------------------
// generateComposeFile — full profile
// ---------------------------------------------------------------------------

describe('generateComposeFile — full profile', () => {
  it('includes all core services plus chatbot, chroma, agents', () => {
    const yaml = generateComposeFile(BASE_MANIFEST, 'full');
    expect(yaml).toContain('node-runtime:');
    expect(yaml).toContain('chatbot:');
    expect(yaml).toContain('chroma:');
    expect(yaml).toContain('agents:');
  });

  it('includes chroma-data volume', () => {
    const yaml = generateComposeFile(BASE_MANIFEST, 'full');
    expect(yaml).toContain('chroma-data:');
  });
});

// ---------------------------------------------------------------------------
// generateComposeFile — self-hosted (targetMode: 'host')
// ---------------------------------------------------------------------------

describe('generateComposeFile — self-hosted', () => {
  it('includes api and dashboard services', () => {
    const yaml = generateComposeFile(SELF_HOSTED_MANIFEST, 'core');
    expect(yaml).toContain('  chroma:');
    expect(yaml).toContain('  api:');
    expect(yaml).toContain('  dashboard:');
  });

  it('exposes expected ports for api and dashboard', () => {
    const yaml = generateComposeFile(SELF_HOSTED_MANIFEST, 'core');
    expect(yaml).toContain('"8000:8000"');
    expect(yaml).toContain('"3003:3003"');
    expect(yaml).toContain('"3000:3000"');
  });

  it('mounts a local sqlite data volume and configures the local database URL', () => {
    const yaml = generateComposeFile(SELF_HOSTED_MANIFEST, 'core');
    expect(yaml).toContain('api-data:/var/lib/cig-node');
    expect(yaml).toContain('chroma-data:/chroma/chroma');
    expect(yaml).toContain('DATABASE_URL=${DATABASE_URL:-sqlite:///var/lib/cig-node/cig.db}');
    expect(yaml).toContain('CHROMA_URL=${CHROMA_URL:-http://chroma:8000}');
    expect(yaml).toContain('CIG_AUTO_MIGRATE=${CIG_AUTO_MIGRATE:-true}');
    expect(yaml).toContain('CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000');
  });

  it('mounts demo mock databases into cartography when demo mode is enabled', () => {
    const yaml = generateComposeFile(SELF_HOSTED_DEMO_MANIFEST, 'core');
    expect(yaml).toContain('./mock-dbs:/opt/cig-node/mock-dbs:ro');
    expect(yaml).toContain('cartography:');
  });
});

// ---------------------------------------------------------------------------
// generateEnvFile — AWS
// ---------------------------------------------------------------------------

describe('generateEnvFile — AWS manifest', () => {
  it('includes node ID and control plane endpoint', () => {
    const env = generateEnvFile(BASE_MANIFEST, NODE_IDENTITY);
    expect(env).toContain(`CIG_NODE_ID=${NODE_IDENTITY.nodeId}`);
    expect(env).toContain(`CIG_CONTROL_PLANE_ENDPOINT=${BASE_MANIFEST.controlPlaneEndpoint}`);
  });

  it('includes cloud provider', () => {
    const env = generateEnvFile(BASE_MANIFEST, NODE_IDENTITY);
    expect(env).toContain('CIG_CLOUD_PROVIDER=aws');
  });

  it('includes AWS role ARN and external ID', () => {
    const env = generateEnvFile(BASE_MANIFEST, NODE_IDENTITY);
    expect(env).toContain(`AWS_ROLE_ARN=${BASE_MANIFEST.awsConfig!.roleArn}`);
    expect(env).toContain(`AWS_EXTERNAL_ID=${BASE_MANIFEST.awsConfig!.externalId}`);
    expect(env).toContain(`AWS_REGION=${BASE_MANIFEST.awsConfig!.region}`);
  });

  it('includes empty GCP vars to prevent compose errors', () => {
    const env = generateEnvFile(BASE_MANIFEST, NODE_IDENTITY);
    expect(env).toContain('GCP_PROJECT_ID=');
    expect(env).toContain('GCP_SA_EMAIL=');
  });

  it('includes a NEO4J_PASSWORD line', () => {
    const env = generateEnvFile(BASE_MANIFEST, NODE_IDENTITY);
    expect(env).toMatch(/NEO4J_PASSWORD=\S+/);
  });
});

// ---------------------------------------------------------------------------
// generateEnvFile — GCP
// ---------------------------------------------------------------------------

describe('generateEnvFile — GCP manifest', () => {
  it('includes GCP project ID and SA email', () => {
    const env = generateEnvFile(GCP_MANIFEST, NODE_IDENTITY);
    expect(env).toContain(`GCP_PROJECT_ID=${GCP_MANIFEST.gcpConfig!.projectId}`);
    expect(env).toContain(`GCP_SA_EMAIL=${GCP_MANIFEST.gcpConfig!.serviceAccountEmail}`);
  });

  it('includes empty AWS vars', () => {
    const env = generateEnvFile(GCP_MANIFEST, NODE_IDENTITY);
    expect(env).toContain('AWS_ROLE_ARN=');
    expect(env).toContain('AWS_EXTERNAL_ID=');
  });

  it('sets cloud provider to gcp', () => {
    const env = generateEnvFile(GCP_MANIFEST, NODE_IDENTITY);
    expect(env).toContain('CIG_CLOUD_PROVIDER=gcp');
  });
});

// ---------------------------------------------------------------------------
// generateEnvFile — self-hosted
// ---------------------------------------------------------------------------

describe('generateEnvFile — self-hosted manifest', () => {
  it('includes local database and demo-ready runtime configuration', () => {
    const env = generateEnvFile(SELF_HOSTED_MANIFEST, NODE_IDENTITY);
    expect(env).toContain('CIG_AUTH_MODE=self-hosted');
    expect(env).toContain('DATABASE_URL=sqlite:///var/lib/cig-node/cig.db');
    expect(env).toContain('CHROMA_URL=http://chroma:8000');
    expect(env).toContain('CIG_AUTO_MIGRATE=true');
  });

  it('enables demo mode when requested', () => {
    const env = generateEnvFile(SELF_HOSTED_DEMO_MANIFEST, NODE_IDENTITY);
    expect(env).toContain('CIG_DEMO_MODE=true');
    expect(env).toContain('CIG_CLOUD_PROVIDER=mock');
  });
});
