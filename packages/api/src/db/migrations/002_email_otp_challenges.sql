-- Migration: 002_email_otp_challenges
-- Stores custom email OTP challenges for SMTP-delivered one-time passcodes.

CREATE TABLE IF NOT EXISTS email_otp_challenges (
  email        TEXT PRIMARY KEY,
  code_hash    TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_otp_challenges_expires_at_idx ON email_otp_challenges (expires_at);
CREATE INDEX IF NOT EXISTS email_otp_challenges_consumed_at_idx ON email_otp_challenges (consumed_at);