import * as os from 'node:os';
import { InstallManifest } from '../compose-generator.js';
import { CredentialManager, TargetIdentity } from '../credentials.js';
import { ApiClient } from '../services/api-client.js';
import { generateEd25519KeyPair } from '../utils/crypto.js';

interface EnrollmentTokenResponse {
  enrollment_token: string;
  expires_at: string;
}

interface EnrollResponse {
  target_id: string;
  enrolled_at?: string;
  certificate?: string;
}

interface InstallManifestResponse {
  profile: 'core' | 'full';
  services: string[];
  env_overrides?: Record<string, string>;
  node_identity: {
    target_id: string;
    public_key: string;
  };
  generated_secrets?: Record<string, string>;
}

export interface EnrollmentFlowOptions {
  apiUrl: string;
  profile?: 'core' | 'full';
  enrollmentToken?: string;
}

function getPrimaryIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaces = interfaces[name];
    if (!ifaces) continue;

    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }

  return '127.0.0.1';
}

async function requestEnrollmentToken(apiClient: ApiClient): Promise<string> {
  const response = await apiClient.post<EnrollmentTokenResponse>('/api/v1/targets/enrollment-token');
  return response.enrollment_token;
}

function createTargetIdentity(targetId: string): TargetIdentity {
  const keyPair = generateEd25519KeyPair();
  return {
    targetId,
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    enrolledAt: new Date().toISOString(),
  };
}

export async function enrollmentFlow(options: EnrollmentFlowOptions): Promise<{
  manifest: InstallManifest;
  identity: TargetIdentity;
}> {
  const credentialManager = new CredentialManager();
  const apiClient = new ApiClient({ baseUrl: options.apiUrl, accessToken: credentialManager.loadTokens()?.accessToken });
  const profile = options.profile ?? 'core';

  const enrollmentToken = options.enrollmentToken ?? await requestEnrollmentToken(apiClient);

  console.log('Enrolling target...');
  const provisionalIdentity = createTargetIdentity('pending');

  const enrollResponse = await apiClient.post<EnrollResponse>('/api/v1/targets/enroll', {
    enrollment_token: enrollmentToken,
    hostname: os.hostname(),
    os: os.platform(),
    architecture: os.arch(),
    ip_address: getPrimaryIpAddress(),
    profile,
    public_key: provisionalIdentity.publicKey,
  });

  const identity: TargetIdentity = {
    ...provisionalIdentity,
    targetId: enrollResponse.target_id,
    enrolledAt: enrollResponse.enrolled_at ?? new Date().toISOString(),
  };

  credentialManager.saveIdentity(identity);

  const manifest = await apiClient.get<InstallManifestResponse>(
    `/api/v1/targets/install-manifest?target_id=${encodeURIComponent(identity.targetId)}&profile=${profile}`
  );

  return {
    identity,
    manifest: {
      profile: manifest.profile,
      services: manifest.services,
      env_overrides: manifest.env_overrides,
      node_identity: {
        target_id: identity.targetId,
        public_key: identity.publicKey,
        private_key: identity.privateKey,
      },
      generated_secrets: manifest.generated_secrets,
    },
  };
}
