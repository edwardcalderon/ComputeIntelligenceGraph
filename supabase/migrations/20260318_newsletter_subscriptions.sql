-- Newsletter subscriptions table
-- Tracks early-access email sign-ups from the landing page.
-- Unique constraint on email prevents duplicates (returns PG error code 23505).

CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT        NOT NULL,
  source         TEXT        NOT NULL DEFAULT 'landing',
  subscribed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT newsletter_subscriptions_email_unique UNIQUE (email)
);

-- Index for fast lookup / admin queries
CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_subscribed_at
  ON newsletter_subscriptions (subscribed_at DESC);

-- Row Level Security: allow anonymous inserts (landing form), block reads
ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (INSERT only)
CREATE POLICY "allow_public_subscribe"
  ON newsletter_subscriptions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only service role can read/delete subscriptions
CREATE POLICY "allow_service_read"
  ON newsletter_subscriptions
  FOR SELECT
  TO service_role
  USING (true);
