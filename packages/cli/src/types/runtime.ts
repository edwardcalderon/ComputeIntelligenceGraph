export type InstallMode = 'managed' | 'self-hosted';
export type InstallProfile = 'core' | 'discovery' | 'full';

export type ConnectionProfileType = 'managed-cloud' | 'direct-api' | 'self-hosted';
export type ConnectionAuthMode = 'managed' | 'self-hosted' | 'none';

export interface ConnectionProfile {
  id: string;
  name: string;
  type: ConnectionProfileType;
  apiUrl: string;
  authMode: ConnectionAuthMode;
  dashboardUrl?: string;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
  metadata?: Record<string, string>;
}

export type PermissionTier = 'tier0' | 'tier1' | 'tier2' | 'tier3' | 'tier4';

export interface NodeIdentity {
  nodeId: string;
  publicKey: string;
  privateKey: string;
  enrolledAt: string;
  certificate?: string;
}

export interface ConnectorManifest {
  id: string;
  type: string;
  state: 'requested' | 'approved' | 'installed' | 'running' | 'blocked' | 'revoked';
  schedule: string;
  approvedDatasets: string[];
  secretRef: string;
  semanticMappings?: Record<string, string>;
}

export interface NodeConfig {
  mode: InstallMode;
  profile: InstallProfile;
  controlPlaneUrl: string;
  localApiUrl?: string;
  heartbeatIntervalSeconds: number;
  commandPollIntervalSeconds: number;
  reconciliationIntervalSeconds: number;
  discoveryProviders: Array<'aws' | 'gcp' | 'local' | 'docker' | 'kubernetes'>;
  approvedPermissionTiers: PermissionTier[];
  connectorManifests: ConnectorManifest[];
}
