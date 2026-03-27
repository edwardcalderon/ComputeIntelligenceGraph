/**
 * TypeScript schema definitions for CIG auth & provisioning tables.
 * Each interface mirrors the corresponding database table row exactly.
 */

// managed_targets
export interface ManagedTarget {
  id: string; // UUID
  user_id: string;
  hostname: string;
  os: string;
  architecture: string;
  ip_address: string;
  profile: 'core' | 'full';
  public_key: string; // Ed25519 public key (PEM)
  status: 'online' | 'degraded' | 'offline' | 'revoked';
  last_seen: Date | null;
  service_status: Record<string, unknown> | null; // JSONB
  system_metrics: Record<string, unknown> | null; // JSONB
  cig_version: string | null;
  created_at: Date;
}

// enrollment_tokens
export interface EnrollmentToken {
  token: string; // UUID
  user_id: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
}

// bootstrap_tokens
export interface BootstrapToken {
  token: string; // 32-char random hex
  expires_at: Date;
  consumed: boolean;
  created_at: Date;
}

// email_otp_challenges
export interface EmailOtpChallenge {
  email: string;
  code_hash: string;
  attempts: number;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// device_auth_records
export interface DeviceAuthRecord {
  device_code: string; // 32 hex chars
  user_code: string; // 8 alphanumeric, unique
  user_id: string | null; // set on approval
  status: 'pending' | 'approved' | 'denied' | 'expired';
  ip_address: string;
  expires_at: Date;
  access_token: string | null;
  refresh_token: string | null;
  session_id: string | null;
  last_polled_at: Date | null;
  created_at: Date;
}

// device_sessions
export interface DeviceSession {
  id: string;
  user_id: string;
  device_code: string;
  device_name: string | null;
  device_os: string | null;
  device_arch: string | null;
  ip_address: string;
  token_hash: string;
  status: 'active' | 'revoked' | 'expired';
  last_active: Date;
  revoked_at: Date | null;
  created_at: Date;
  metadata: Record<string, unknown> | null;
}

// chat_sessions
export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  last_message_preview: string | null;
  last_message_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// chat_messages
export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: Date;
}

// oidc_states
export interface OidcState {
  state: string;
  user_id: string;
  redirect_uri: string | null;
  expires_at: Date;
  created_at: Date;
}

// refresh_tokens
export interface RefreshToken {
  token: string;
  user_id: string;
  expires_at: Date;
  created_at: Date;
}

// scan_results
export interface ScanResult {
  id: string;
  node_id: string;
  scan_type: 'local' | 'cloud' | 'all';
  provider: string | null;
  started_at: Date;
  completed_at: Date | null;
  status: 'running' | 'completed' | 'failed';
  summary_json: Record<string, unknown> | null;
  created_at: Date;
}

// scan_assets
export interface ScanAsset {
  id: string;
  scan_id: string;
  asset_type: string;
  provider: string;
  identifier: string;
  metadata_json: Record<string, unknown> | null;
  created_at: Date;
}

// audit_events
export interface AuditEvent {
  id: string; // UUID
  event_type: string;
  actor: string; // user_id or target_id
  ip_address: string;
  outcome: 'success' | 'failure';
  metadata: Record<string, unknown> | null; // JSONB
  created_at: Date;
}

// admin_accounts (self-hosted only)
export interface AdminAccount {
  id: string; // UUID
  username: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

// Insert types (omit server-generated fields)
export type NewManagedTarget = Omit<ManagedTarget, 'id' | 'created_at' | 'status' | 'last_seen' | 'service_status' | 'system_metrics' | 'cig_version'>;
export type NewEnrollmentToken = Omit<EnrollmentToken, 'created_at' | 'used'>;
export type NewBootstrapToken = Omit<BootstrapToken, 'created_at' | 'consumed'>;
export type NewEmailOtpChallenge = Omit<EmailOtpChallenge, 'created_at' | 'updated_at' | 'consumed_at'>;
export type NewDeviceAuthRecord = Omit<DeviceAuthRecord, 'created_at' | 'status' | 'user_id' | 'access_token' | 'refresh_token' | 'session_id' | 'last_polled_at'>;
export type NewAuditEvent = Omit<AuditEvent, 'id' | 'created_at'>;
export type NewAdminAccount = Omit<AdminAccount, 'id' | 'created_at'>;

// ─── CIG Node Onboarding Entities ────────────────────────────────────────────
// Requirements: 18.1–18.10

// onboarding_intents
export interface OnboardingIntent {
  id: string; // UUID
  user_id: string;
  cloud_provider: 'aws' | 'gcp';
  credentials_ref: string; // Role ARN or SA email
  install_profile: 'core' | 'full';
  target_mode: 'local' | 'ssh' | 'host';
  status:
    | 'draft'
    | 'manifest_ready'
    | 'cli_started'
    | 'node_enrolled'
    | 'credential_validated'
    | 'discovery_started'
    | 'online'
    | 'enrollment_failed'
    | 'credential_error'
    | 'discovery_failed';
  created_at: Date;
  updated_at: Date;
}

// setup_manifest_records
export interface SetupManifestRecord {
  id: string;
  intent_id: string;
  manifest_payload: string; // signed JSON blob
  enrollment_token_id: string;
  expires_at: Date;
  created_at: Date;
}

// enrollment_token_records
export interface EnrollmentTokenRecord {
  id: string;
  manifest_id: string;
  token_hash: string; // bcrypt hash of the UUID token
  used_at: Date | null;
  expires_at: Date; // issuedAt + 15 minutes
  created_at: Date;
}

// managed_nodes
export interface ManagedNode {
  id: string; // UUID, the node's identity
  user_id: string;
  intent_id: string;
  hostname: string;
  os: string;
  architecture: string;
  ip_address: string;
  install_profile: 'core' | 'full';
  mode: 'managed' | 'self-hosted';
  status: 'enrolling' | 'online' | 'degraded' | 'offline' | 'credential-error' | 'revoked';
  last_seen_at: Date | null;
  permission_tier: 0 | 1 | 2 | 3 | 4;
  created_at: Date;
}

// node_identity_records
export interface NodeIdentityRecord {
  id: string;
  node_id: string;
  public_key: string; // Ed25519 public key, base64
  revoked_at: Date | null;
  created_at: Date;
}

// bootstrap_token_records
export interface BootstrapTokenRecord {
  id: string;
  token_hash: string;
  first_accessed_at: Date | null;
  used_at: Date | null;
  expires_at: Date; // first_accessed_at + 30 minutes
  created_at: Date;
}

// heartbeat_records
export interface HeartbeatRecord {
  id: string;
  node_id: string;
  received_at: Date;
  service_health: Record<string, string>; // JSONB
  system_metrics: {
    cpuPercent: number;
    memoryPercent: number;
    diskPercent: number;
  }; // JSONB
  permission_tier: number;
  active_connectors: string[]; // JSONB
}

// connector_requests
export interface ConnectorRequest {
  id: string;
  node_id: string;
  connector_type: string;
  required_permissions: string[]; // JSONB
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  approved_at: Date | null;
  created_at: Date;
}

// installation_events
export interface InstallationEvent {
  id: string;
  node_id: string;
  event_type: string;
  payload: Record<string, unknown>; // JSONB
  created_at: Date;
}

// onboarding_audit_events
export interface OnboardingAuditEvent {
  id: string;
  actor_type: 'human' | 'node' | 'system';
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, unknown>; // JSONB
  created_at: Date;
}

// Insert types
export type NewOnboardingIntent = Omit<OnboardingIntent, 'created_at' | 'updated_at' | 'status'>;
export type NewSetupManifestRecord = Omit<SetupManifestRecord, 'created_at'>;
export type NewEnrollmentTokenRecord = Omit<EnrollmentTokenRecord, 'created_at' | 'used_at'>;
export type NewManagedNode = Omit<ManagedNode, 'created_at' | 'status' | 'last_seen_at'>;
export type NewNodeIdentityRecord = Omit<NodeIdentityRecord, 'created_at' | 'revoked_at'>;
export type NewBootstrapTokenRecord = Omit<BootstrapTokenRecord, 'created_at' | 'first_accessed_at' | 'used_at'>;
export type NewHeartbeatRecord = Omit<HeartbeatRecord, 'received_at'>;
export type NewConnectorRequest = Omit<ConnectorRequest, 'created_at' | 'status' | 'approved_at'>;
export type NewInstallationEvent = Omit<InstallationEvent, 'created_at'>;
export type NewOnboardingAuditEvent = Omit<OnboardingAuditEvent, 'created_at'>;
