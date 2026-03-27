/**
 * Docker Compose and .env file generation for CIG Node runtime.
 *
 * Renders docker-compose.yml and .env from a SetupManifest and install profile.
 * Supports core, full, and self-hosted profiles per the design template.
 *
 * Requirements: 5.9, 6.1
 */

// Inline types — mirror packages/sdk/src/types.ts to avoid a cross-package dependency

export interface AWSManifestConfig {
  roleArn: string;
  externalId: string;
  region: string;
}

export interface GCPManifestConfig {
  projectId: string;
  serviceAccountEmail: string;
  impersonationEnabled: boolean;
}

export interface SetupManifest {
  version: string;
  cloudProvider: 'aws' | 'gcp';
  credentialsRef: string;
  enrollmentToken: string;
  nodeIdentitySeed: string;
  installProfile: 'core' | 'discovery' | 'full';
  targetMode: 'local' | 'ssh' | 'host';
  controlPlaneEndpoint: string;
  awsConfig?: AWSManifestConfig;
  gcpConfig?: GCPManifestConfig;
  signature: string;
  issuedAt: string;
  expiresAt: string;
}

import type { NodeIdentity } from './install.js';
export type { NodeIdentity };

// ---------------------------------------------------------------------------
// Core compose template
// ---------------------------------------------------------------------------

const CORE_SERVICES = `\
  node-runtime:
    image: ghcr.io/cig/node-runtime:\${CIG_VERSION}
    restart: unless-stopped
    volumes:
      - ./identity:/opt/cig-node/identity:ro
      - ./config:/opt/cig-node/config:ro
    environment:
      - CIG_NODE_ID=\${CIG_NODE_ID}
      - CIG_CONTROL_PLANE=\${CIG_CONTROL_PLANE_ENDPOINT}
      - CIG_CLOUD_PROVIDER=\${CIG_CLOUD_PROVIDER}
    depends_on:
      - discovery-worker
      - graph-writer

  discovery-worker:
    image: ghcr.io/cig/discovery-worker:\${CIG_VERSION}
    restart: unless-stopped
    environment:
      - CIG_CLOUD_PROVIDER=\${CIG_CLOUD_PROVIDER}
      - AWS_ROLE_ARN=\${AWS_ROLE_ARN}
      - AWS_EXTERNAL_ID=\${AWS_EXTERNAL_ID}
      - GCP_PROJECT_ID=\${GCP_PROJECT_ID}
      - GCP_SA_EMAIL=\${GCP_SA_EMAIL}

  cartography:
    image: ghcr.io/cig/cartography:\${CIG_VERSION}
    restart: unless-stopped
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_PASSWORD=\${NEO4J_PASSWORD}

  graph-writer:
    image: ghcr.io/cig/graph-writer:\${CIG_VERSION}
    restart: unless-stopped
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_PASSWORD=\${NEO4J_PASSWORD}
      - CIG_CONTROL_PLANE=\${CIG_CONTROL_PLANE_ENDPOINT}

  neo4j:
    image: neo4j:5
    restart: unless-stopped
    volumes:
      - neo4j-data:/data
    environment:
      - NEO4J_AUTH=neo4j/\${NEO4J_PASSWORD}`;

// ---------------------------------------------------------------------------
// Additional services for full profile
// ---------------------------------------------------------------------------

const FULL_EXTRA_SERVICES = `
  chatbot:
    image: ghcr.io/cig/chatbot:\${CIG_VERSION}
    restart: unless-stopped
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_PASSWORD=\${NEO4J_PASSWORD}
      - CIG_CONTROL_PLANE=\${CIG_CONTROL_PLANE_ENDPOINT}

  chroma:
    image: ghcr.io/cig/chroma:\${CIG_VERSION}
    restart: unless-stopped
    volumes:
      - chroma-data:/chroma/chroma

  agents:
    image: ghcr.io/cig/agents:\${CIG_VERSION}
    restart: unless-stopped
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_PASSWORD=\${NEO4J_PASSWORD}
      - CHROMA_URI=http://chroma:8000
      - CIG_CONTROL_PLANE=\${CIG_CONTROL_PLANE_ENDPOINT}`;

// ---------------------------------------------------------------------------
// Additional services for self-hosted profile
// ---------------------------------------------------------------------------

const SELF_HOSTED_EXTRA_SERVICES = `
  api:
    image: ghcr.io/cig/api:\${CIG_VERSION}
    restart: unless-stopped
    ports:
      - "3003:3003"
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_PASSWORD=\${NEO4J_PASSWORD}
      - DATABASE_URL=\${DATABASE_URL}
    depends_on:
      - neo4j

  dashboard:
    image: ghcr.io/cig/dashboard:\${CIG_VERSION}
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3003
    depends_on:
      - api`;

// ---------------------------------------------------------------------------
// Volume declarations
// ---------------------------------------------------------------------------

function buildVolumes(profile: 'core' | 'discovery' | 'full', selfHosted: boolean): string {
  const volumes: string[] = ['  neo4j-data:'];
  if (profile === 'full') {
    volumes.push('  chroma-data:');
  }
  if (selfHosted) {
    volumes.push('  postgres-data:');
  }
  return volumes.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a docker-compose.yml string from a SetupManifest and install profile.
 *
 * - `core`: node-runtime, discovery-worker, cartography, graph-writer, neo4j
 * - `full`: core + chatbot, chroma, agents
 *
 * When the manifest's `targetMode` is `'host'` (self-hosted), the api and
 * dashboard services are appended as well.
 *
 * Requirements: 5.9, 6.1
 */
export function generateComposeFile(
  manifest: SetupManifest,
  profile: 'core' | 'discovery' | 'full'
): string {
  const selfHosted = manifest.targetMode === 'host';

  let services = CORE_SERVICES;

  if (profile === 'full') {
    services += FULL_EXTRA_SERVICES;
  }

  if (selfHosted) {
    services += SELF_HOSTED_EXTRA_SERVICES;
  }

  const volumes = buildVolumes(profile, selfHosted);

  return [
    "version: '3.8'",
    'services:',
    services,
    '',
    'volumes:',
    volumes,
    '',
  ].join('\n');
}

/**
 * Generate a .env file string from a SetupManifest and NodeIdentity.
 *
 * The .env file is written alongside docker-compose.yml in the install
 * directory and provides all runtime environment variables for the stack.
 *
 * Requirements: 5.9, 6.2
 */
export function generateEnvFile(
  manifest: SetupManifest,
  nodeIdentity: NodeIdentity
): string {
  const lines: string[] = [
    '# Generated by CIG CLI — do not edit manually',
    `# Generated at: ${new Date().toISOString()}`,
    '',
    '# Node identity',
    `CIG_NODE_ID=${nodeIdentity.nodeId}`,
    '',
    '# Control plane',
    `CIG_CONTROL_PLANE_ENDPOINT=${manifest.controlPlaneEndpoint}`,
    '',
    '# Cloud provider',
    `CIG_CLOUD_PROVIDER=${manifest.cloudProvider}`,
    '',
    '# Image version (override with --version flag)',
    'CIG_VERSION=latest',
    '',
    '# Neo4j credentials (auto-generated — change if desired)',
    `NEO4J_PASSWORD=${_randomHex(16)}`,
    '',
  ];

  if (manifest.cloudProvider === 'aws' && manifest.awsConfig) {
    lines.push('# AWS configuration');
    lines.push(`AWS_ROLE_ARN=${manifest.awsConfig.roleArn}`);
    lines.push(`AWS_EXTERNAL_ID=${manifest.awsConfig.externalId}`);
    lines.push(`AWS_REGION=${manifest.awsConfig.region}`);
    lines.push('');
    // GCP vars left empty so the compose file doesn't error on missing vars
    lines.push('GCP_PROJECT_ID=');
    lines.push('GCP_SA_EMAIL=');
    lines.push('');
  } else if (manifest.cloudProvider === 'gcp' && manifest.gcpConfig) {
    lines.push('# GCP configuration');
    lines.push(`GCP_PROJECT_ID=${manifest.gcpConfig.projectId}`);
    lines.push(`GCP_SA_EMAIL=${manifest.gcpConfig.serviceAccountEmail}`);
    lines.push('');
    // AWS vars left empty
    lines.push('AWS_ROLE_ARN=');
    lines.push('AWS_EXTERNAL_ID=');
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _randomHex(bytes: number): string {
  // Use crypto if available (Node.js), otherwise fall back to Math.random
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('node:crypto') as typeof import('node:crypto');
    return crypto.randomBytes(bytes).toString('hex');
  } catch {
    return Array.from({ length: bytes * 2 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }
}
