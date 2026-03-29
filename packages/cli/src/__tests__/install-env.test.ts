import { describe, expect, it } from 'vitest';
import type { NodeIdentity, SetupManifest } from '../sdk.js';
import { generateComposeFile, generateEnvFile } from '../commands/install.js';

function buildManifest(): SetupManifest {
  return {
    version: '1.0',
    cloudProvider: 'aws',
    credentialsRef: 'arn:aws:iam::123456789012:role/test',
    enrollmentToken: 'enrollment-token',
    nodeIdentitySeed: 'node-identity-seed',
    installProfile: 'discovery',
    targetMode: 'host',
    controlPlaneEndpoint: 'http://localhost:3003',
    signature: 'deadbeef',
    issuedAt: '2026-03-29T00:00:00.000Z',
    expiresAt: '2026-03-29T00:15:00.000Z',
    isDemo: true,
  };
}

function buildNodeIdentity(): NodeIdentity {
  return {
    nodeId: 'node-id',
    privateKey: 'private-key',
    publicKey: 'public-key',
    issuedAt: '2026-03-29T00:00:00.000Z',
  };
}

describe('generateEnvFile', () => {
  it('includes the bootstrap token in self-hosted environments', () => {
    const env = generateEnvFile(buildManifest(), buildNodeIdentity(), 'ollama', 'bootstrap-token-123');

    expect(env).toContain('CIG_AUTH_MODE=self-hosted');
    expect(env).toContain('CIG_BOOTSTRAP_TOKEN=bootstrap-token-123');
    expect(env).toMatch(/^JWT_SECRET=[0-9a-f]{128}$/m);
  });
});

describe('generateComposeFile', () => {
  it('passes the bootstrap and JWT secrets into the api service environment', () => {
    const compose = generateComposeFile(buildManifest(), 'discovery');

    expect(compose).toContain('CIG_BOOTSTRAP_TOKEN=${CIG_BOOTSTRAP_TOKEN:-}');
    expect(compose).toContain('JWT_SECRET=${JWT_SECRET:-}');
  });
});
