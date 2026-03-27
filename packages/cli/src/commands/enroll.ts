import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ApiClient } from '../services/api-client.js';
import { CredentialManager } from '../credentials.js';
import type { NodeIdentity } from '../sdk.js';

export interface EnrollCommandOptions {
  apiUrl: string;
  profile?: 'core' | 'discovery' | 'full';
  token?: string;
  nodeId?: string;
}

/** Returns the first non-loopback IPv4 address, or 127.0.0.1 as fallback. */
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

/** Write NodeIdentity to ~/.cig/node-identity.json with 0600 permissions. */
function writeNodeIdentityFile(identity: NodeIdentity): void {
  const cigDir = path.join(os.homedir(), '.cig');
  if (!fs.existsSync(cigDir)) {
    fs.mkdirSync(cigDir, { recursive: true, mode: 0o700 });
  }
  const identityFile = path.join(cigDir, 'node-identity.json');
  fs.writeFileSync(identityFile, JSON.stringify(identity, null, 2), { mode: 0o600 });
}

/**
 * `cig enroll` — re-enroll an existing CIG Node without reinstalling.
 *
 * Calls POST /api/v1/nodes/enroll with the enrollment token and node metadata,
 * then persists the returned NodeIdentity to disk.
 *
 * Requirements: 4.4, 7.3, 7.4
 */
export async function enroll(options: EnrollCommandOptions): Promise<void> {
  const { apiUrl, token, nodeId } = options;

  if (!token) {
    throw new Error('Enrollment token is required. Use --token <token>');
  }

  const credentialManager = new CredentialManager();
  const accessToken = credentialManager.loadTokens()?.accessToken;
  const apiClient = new ApiClient({ baseUrl: apiUrl, accessToken });

  const identity = await apiClient.post<NodeIdentity>('/api/v1/nodes/enroll', {
    enrollmentToken: token,
    nodeId,
    hostname: os.hostname(),
    os: process.platform,
    architecture: process.arch,
    ipAddress: getPrimaryIpAddress(),
    installProfile: options.profile ?? 'core',
    mode: 'managed',
  });

  // Persist to ~/.cig/node-identity.json (0600)
  writeNodeIdentityFile(identity);

  // Also save via CredentialManager for other CLI commands to use
  credentialManager.saveIdentity({
    targetId: identity.nodeId,
    publicKey: identity.publicKey,
    privateKey: identity.privateKey,
    enrolledAt: identity.issuedAt,
  });

  console.log(`✓ Node enrolled successfully. Node ID: ${identity.nodeId}`);
}
