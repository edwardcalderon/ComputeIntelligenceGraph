-- Phase 1.1: Create device_sessions table for CLI session persistence
-- Tracks authenticated CLI device sessions so they can be managed from the Dashboard.

create table if not exists public.device_sessions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.users(id) on delete cascade,
  device_code text        not null,
  device_name text,
  device_os   text,
  device_arch text,
  ip_address  inet,
  token_hash  text        not null,
  status      text        not null default 'active'
    check (status in ('active', 'revoked', 'expired')),
  last_active timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  metadata    jsonb       not null default '{}'::jsonb
);

-- Index for querying sessions by user
create index if not exists idx_device_sessions_user_id
  on public.device_sessions (user_id);

-- Index for querying active sessions
create index if not exists idx_device_sessions_status
  on public.device_sessions (status)
  where status = 'active';

-- Index for token hash lookup (logout / revocation)
create index if not exists idx_device_sessions_token_hash
  on public.device_sessions (token_hash);

-- Enable RLS
alter table public.device_sessions enable row level security;

-- Users can read their own sessions
create policy "Users can view own sessions"
  on public.device_sessions
  for select
  using (user_id = auth.uid());

-- Service role manages all sessions
create policy "Service role manages device_sessions"
  on public.device_sessions
  for all
  using (true)
  with check (true);
