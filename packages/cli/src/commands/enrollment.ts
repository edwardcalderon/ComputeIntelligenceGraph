/**
 * Managed Enrollment Sub-Flow
 *
 * Implements the enrollment flow for managed mode:
 * 1. POST to /api/v1/targets/enrollment-token to get enrollment token
 * 2. POST to /api/v1/targets/enroll with target metadata
 * 3. GET /api/v1/targets/install-manifest to retrieve manifest
 * 4. Save Node_Identity to ~/.cig/auth.json with permissions 0600
 *
 * Requirement 4: Enrollment Token and Install Manifest
 */

import * as os from 'os';
import * as net from 'net';
import { CredentialManager, TargetIdentity } from '../credentials.js';
import { InstallManifest } from '../compose-generator.js';

interface EnrollmentTokenResponse {
  enrollment_token: string;
  expires_in: number;
}

interface EnrollResponse {
  target_id: string;
  private_key: string;
  public_key: string;
}

interface InstallManifestResponse {
  profile: 'core' | 'full';
  services: string[];
  env_overrides?: Record<string, string>;
  node_identity: {
    target_id: string;
    private_key: string;
    public_key: string;
  };
  generated_secrets?: Record<string, string>;
}

/**
 * Get the primary IP address of the host.
 */
function getPrimaryIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaces = interfaces[name];
    if (!ifaces) continue;

    for (const iface of ifaces) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

/**
 * Enrollment flow for managed mode.
 * Returns InstallManifest for compose generation.
 */
export async function enrollmentFlow(apiUrl: string): Promise<InstallManifest> {
  const credentialManager = new CredentialManager();

  // Step 1: Get enrollment token
  console.log('Requesting enrollment token...');
  let enrollmentToken: string;

  try {
    const response = await fetch(`${apiUrl}/api/v1/targets/enrollment-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to get enrollment token: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as EnrollmentTokenResponse;
    enrollmentToken = data.enrollment_token;
    console.log('✓ Enrollment token obtained');
  } catch (err) {
    console.error('✗ Failed to get enrollment token:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Step 2: Enroll target with metadata
  console.log('Enrolling target...');
  let enrollResponse: EnrollResponse;

  try {
    const targetMetadata = {
      enrollment_token: enrollmentToken,
      hostname: os.hostname(),
      os: os.platform(),
      architecture: os.arch(),
      ip_address: getPrimaryIpAddress(),
    };

    const response = await fetch(`${apiUrl}/api/v1/targets/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(targetMetadata),
    });

    if (!response.ok) {
      throw new Error(`Enrollment failed: ${response.status} ${response.statusText}`);
    }

    enrollResponse = (await response.json()) as EnrollResponse;
    console.log('✓ Target enrolled successfully');
  } catch (err) {
    console.error('✗ Enrollment failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Step 3: Save Node_Identity to ~/.cig/auth.json
  const identity: TargetIdentity = {
    targetId: enrollResponse.target_id,
    publicKey: enrollResponse.public_key,
    privateKey: enrollResponse.private_key,
    enrolledAt: new Date().toISOString(),
  };

  try {
    credentialManager.saveIdentity(identity);
    console.log('✓ Node identity saved to ~/.cig/auth.json');
  } catch (err) {
    console.error('✗ Failed to save identity:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Step 4: Get install manifest
  console.log('Retrieving install manifest...');
  let manifest: InstallManifestResponse;

  try {
    const response = await fetch(
      `${apiUrl}/api/v1/targets/install-manifest?target_id=${enrollResponse.target_id}&profile=core`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get install manifest: ${response.status} ${response.statusText}`);
    }

    manifest = (await response.json()) as InstallManifestResponse;
    console.log('✓ Install manifest retrieved');
  } catch (err) {
    console.error('✗ Failed to get install manifest:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  return {
    profile: manifest.profile,
    services: manifest.services,
    env_overrides: manifest.env_overrides,
    node_identity: manifest.node_identity,
    generated_secrets: manifest.generated_secrets,
  };
}
