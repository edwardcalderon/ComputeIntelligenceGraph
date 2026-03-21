-- Migration: 001_auth_provisioning
-- Creates all tables required for CIG authentication and provisioning.

-- managed_targets: enrolled target nodes
CREATE TABLE IF NOT EXISTS managed_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  hostname      TEXT NOT NULL,
  os            TEXT NOT NULL,
  architecture  TEXT NOT NULL,
  ip_address    TEXT NOT NULL,
  profile       TEXT NOT NULL CHECK (profile IN ('core', 'full')),
  public_key    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'online'
                  CHECK (status IN ('online', 'degraded', 'offline', 'revoked')),
  last_seen     TIMESTAMPTZ,
  service_status JSONB,
  system_metrics JSONB,
  cig_version   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS managed_targets_user_id_idx ON managed_targets (user_id);
CREATE INDEX IF NOT EXISTS managed_targets_status_idx  ON managed_targets (status);

-- enrollment_tokens: short-lived single-use tokens for node enrollment
CREATE TABLE IF NOT EXISTS enrollment_tokens (
  token         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  used          BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enrollment_tokens_user_id_idx ON enrollment_tokens (user_id);

-- bootstrap_tokens: one-time tokens for self-hosted first-run setup
CREATE TABLE IF NOT EXISTS bootstrap_tokens (
  token         TEXT PRIMARY KEY,
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- device_auth_records: RFC 8628 device authorization grant state
CREATE TABLE IF NOT EXISTS device_auth_records (
  device_code    TEXT PRIMARY KEY,
  user_code      TEXT NOT NULL UNIQUE,
  user_id        TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  ip_address     TEXT NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  access_token   TEXT,
  refresh_token  TEXT,
  last_polled_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS device_auth_records_user_code_idx  ON device_auth_records (user_code);
CREATE INDEX IF NOT EXISTS device_auth_records_expires_at_idx ON device_auth_records (expires_at);

-- audit_events: immutable audit log for all auth and provisioning actions
CREATE TABLE IF NOT EXISTS audit_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,
  actor       TEXT NOT NULL,
  ip_address  TEXT NOT NULL,
  outcome     TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_created_at_idx ON audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_idx      ON audit_events (actor);

-- admin_accounts: local admin users for self-hosted mode only
CREATE TABLE IF NOT EXISTS admin_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
