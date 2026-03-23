-- Phase 0.6: Create oidc_states table for CSRF protection
-- Stores the OIDC state parameter used during the authorization code flow
-- to prevent CSRF attacks.

create table if not exists public.oidc_states (
  state        text        primary key,
  user_id      text        not null,
  redirect_uri text,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

-- Index for cleanup of expired states
create index if not exists idx_oidc_states_expires_at
  on public.oidc_states (expires_at);

-- Enable RLS
alter table public.oidc_states enable row level security;

-- Service-role only access (API server inserts/deletes states)
create policy "Service role manages oidc_states"
  on public.oidc_states
  for all
  using (true)
  with check (true);
