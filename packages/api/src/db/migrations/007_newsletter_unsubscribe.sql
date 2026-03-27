-- Add locale, unsubscribe_token and unsubscribed_at to newsletter_subscriptions.
-- These columns power token-based unsubscription and locale-aware welcome emails.

ALTER TABLE newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS locale            TEXT        NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS unsubscribe_token UUID        NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS unsubscribed_at   TIMESTAMPTZ;

-- Fast lookup for the unsubscribe endpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_unsubscribe_token
  ON newsletter_subscriptions (unsubscribe_token);

-- Allow service role to UPDATE rows (needed to mark unsubscribed_at)
CREATE POLICY "allow_service_update"
  ON newsletter_subscriptions
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
