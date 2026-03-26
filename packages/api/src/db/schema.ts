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
