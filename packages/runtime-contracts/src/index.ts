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

export type NodeState =
  | 'new'
  | 'installing'
  | 'bootstrap_pending'
  | 'enrollment_pending'
  | 'enrolled'
  | 'running'
  | 'degraded'
  | 'offline'
  | 'revoked'
  | 'upgrade_pending'
  | 'error'
  | 'uninstalled';

export type ConnectorState =
  | 'requested'
  | 'approved'
  | 'installed'
  | 'running'
  | 'blocked'
  | 'revoked';

export interface NodeIdentity {
  nodeId: string;
  publicKey: string;
  privateKey: string;
  enrolledAt: string;
  certificate?: string;
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

export interface RuntimeStatus {
  nodeId?: string;
  state: NodeState;
  startedAt?: string;
  lastHeartbeatAt?: string;
  lastDiscoveryRunAt?: string;
  lastGraphSyncAt?: string;
  connectionProfileId?: string;
  activeConnectors: Array<{
    id: string;
    state: ConnectorState;
  }>;
  pendingPermissionRequests: PermissionRequest[];
}

export interface DiscoverySnapshot {
  runId: string;
  provider: 'aws' | 'gcp' | 'local' | 'docker' | 'kubernetes';
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  resourceCount?: number;
  summary?: Record<string, number>;
}

export interface GraphDeltaEnvelope {
  nodeId: string;
  generatedAt: string;
  source: 'full-scan' | 'event' | 'reconciliation' | 'connector';
  resources: Array<Record<string, unknown>>;
  relationships: Array<Record<string, unknown>>;
}

export interface CommandEnvelope {
  commandId: string;
  type:
    | 'refresh-config'
    | 'rotate-identity'
    | 'run-discovery'
    | 'install-connector'
    | 'remove-connector'
    | 'request-permissions';
  issuedAt: string;
  payload?: Record<string, unknown>;
}

export type PermissionTier = 'tier0' | 'tier1' | 'tier2' | 'tier3' | 'tier4';

export interface PermissionGrant {
  tier: PermissionTier;
  scope: string;
  grantedAt: string;
  grantedBy?: string;
  expiresAt?: string;
  metadata?: Record<string, string>;
}

export interface PermissionRequest {
  id: string;
  tier: PermissionTier;
  reason: string;
  scope: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'denied';
}

export interface ConnectorManifest {
  id: string;
  type: string;
  state: ConnectorState;
  schedule: string;
  approvedDatasets: string[];
  secretRef: string;
  semanticMappings?: Record<string, string>;
}
