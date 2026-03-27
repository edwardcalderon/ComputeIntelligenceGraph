-- Migration: 004_cig_node_onboarding
-- Creates all tables required for CIG Node onboarding entities.
-- Requirements: 18.1–18.10

-- onboarding_intents: tracks a user's intent to connect a cloud account
CREATE TABLE IF NOT EXISTS onboarding_intents (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  cloud_provider   TEXT NOT NULL CHECK (cloud_provider IN ('aws', 'gcp')),
  credentials_ref  TEXT NOT NULL,
  install_profile  TEXT NOT NULL CHECK (install_profile IN ('core', 'full')),
  target_mode      TEXT NOT NULL CHECK (target_mode IN ('local', 'ssh', 'host')),
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN (
                       'draft', 'manifest_ready', 'cli_started', 'node_enrolled',
                       'credential_validated', 'discovery_started', 'online',
                       'enrollment_failed', 'credential_error', 'discovery_failed'
                     )),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_intents_user_id_idx ON onboarding_intents (user_id);
CREATE INDEX IF NOT EXISTS onboarding_intents_status_idx  ON onboarding_intents (status);

-- setup_manifest_records: signed manifest blobs generated per intent
CREATE TABLE IF NOT EXISTS setup_manifest_records (
  id                  TEXT PRIMARY KEY,
  intent_id           TEXT NOT NULL,
  manifest_payload    TEXT NOT NULL,
  enrollment_token_id TEXT NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS setup_manifest_records_intent_id_idx ON setup_manifest_records (intent_id);

-- enrollment_token_records: hashed single-use enrollment tokens
CREATE TABLE IF NOT EXISTS enrollment_token_records (
  id          TEXT PRIMARY KEY,
  manifest_id TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enrollment_token_records_manifest_id_idx ON enrollment_token_records (manifest_id);

-- managed_nodes: enrolled CIG Node instances
CREATE TABLE IF NOT EXISTS managed_nodes (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  intent_id       TEXT NOT NULL,
  hostname        TEXT NOT NULL,
  os              TEXT NOT NULL,
  architecture    TEXT NOT NULL,
  ip_address      TEXT NOT NULL,
  install_profile TEXT NOT NULL CHECK (install_profile IN ('core', 'full')),
  mode            TEXT NOT NULL CHECK (mode IN ('managed', 'self-hosted')),
  status          TEXT NOT NULL DEFAULT 'enrolling'
                    CHECK (status IN (
                      'enrolling', 'online', 'degraded', 'offline', 'credential-error', 'revoked'
                    )),
  last_seen_at    TIMESTAMPTZ,
  permission_tier INTEGER NOT NULL DEFAULT 0
                    CHECK (permission_tier BETWEEN 0 AND 4),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS managed_nodes_user_id_idx   ON managed_nodes (user_id);
CREATE INDEX IF NOT EXISTS managed_nodes_intent_id_idx ON managed_nodes (intent_id);
CREATE INDEX IF NOT EXISTS managed_nodes_status_idx    ON managed_nodes (status);

-- node_identity_records: Ed25519 public keys for enrolled nodes
CREATE TABLE IF NOT EXISTS node_identity_records (
  id          TEXT PRIMARY KEY,
  node_id     TEXT NOT NULL,
  public_key  TEXT NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS node_identity_records_node_id_idx ON node_identity_records (node_id);

-- bootstrap_token_records: hashed one-time bootstrap tokens for self-hosted installs
CREATE TABLE IF NOT EXISTS bootstrap_token_records (
  id                 TEXT PRIMARY KEY,
  token_hash         TEXT NOT NULL,
  first_accessed_at  TIMESTAMPTZ,
  used_at            TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- heartbeat_records: periodic liveness reports from enrolled nodes
CREATE TABLE IF NOT EXISTS heartbeat_records (
  id                TEXT PRIMARY KEY,
  node_id           TEXT NOT NULL,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  service_health    JSONB NOT NULL DEFAULT '{}',
  system_metrics    JSONB NOT NULL DEFAULT '{}',
  permission_tier   INTEGER NOT NULL CHECK (permission_tier BETWEEN 0 AND 4),
  active_connectors JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS heartbeat_records_node_id_idx      ON heartbeat_records (node_id);
CREATE INDEX IF NOT EXISTS heartbeat_records_received_at_idx  ON heartbeat_records (received_at DESC);

-- connector_requests: user-approved sensitive connector installations
CREATE TABLE IF NOT EXISTS connector_requests (
  id                   TEXT PRIMARY KEY,
  node_id              TEXT NOT NULL,
  connector_type       TEXT NOT NULL,
  required_permissions JSONB NOT NULL DEFAULT '[]',
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  approved_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS connector_requests_node_id_idx ON connector_requests (node_id);
CREATE INDEX IF NOT EXISTS connector_requests_status_idx  ON connector_requests (status);

-- installation_events: audit trail for onboarding state transitions
CREATE TABLE IF NOT EXISTS installation_events (
  id          TEXT PRIMARY KEY,
  node_id     TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS installation_events_node_id_idx     ON installation_events (node_id);
CREATE INDEX IF NOT EXISTS installation_events_created_at_idx  ON installation_events (created_at DESC);

-- onboarding_audit_events: security audit log for identity plane crossings and state transitions
-- (separate from the existing audit_events table which tracks auth/provisioning actions)
CREATE TABLE IF NOT EXISTS onboarding_audit_events (
  id             TEXT PRIMARY KEY,
  actor_type     TEXT NOT NULL CHECK (actor_type IN ('human', 'node', 'system')),
  actor_id       TEXT NOT NULL,
  action         TEXT NOT NULL,
  resource_type  TEXT NOT NULL,
  resource_id    TEXT NOT NULL,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_audit_events_actor_id_idx    ON onboarding_audit_events (actor_id);
CREATE INDEX IF NOT EXISTS onboarding_audit_events_created_at_idx  ON onboarding_audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS onboarding_audit_events_resource_idx    ON onboarding_audit_events (resource_type, resource_id);
