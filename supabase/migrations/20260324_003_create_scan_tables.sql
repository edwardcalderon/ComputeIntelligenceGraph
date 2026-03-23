-- Phase 3.1: Create scan tables for cartography scan results
-- Stores scan execution metadata and discovered assets.

-- scan_results: tracks individual scan runs
create table if not exists public.scan_results (
  id            uuid        primary key default gen_random_uuid(),
  node_id       uuid,
  scan_type     text        not null check (scan_type in ('local', 'cloud', 'all')),
  provider      text,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  status        text        not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  summary_json  jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_scan_results_node_id
  on public.scan_results (node_id);

create index if not exists idx_scan_results_status
  on public.scan_results (status);

-- scan_assets: individual assets discovered during a scan
create table if not exists public.scan_assets (
  id            uuid        primary key default gen_random_uuid(),
  scan_id       uuid        not null references public.scan_results(id) on delete cascade,
  asset_type    text        not null,
  provider      text        not null,
  identifier    text        not null,
  metadata_json jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_scan_assets_scan_id
  on public.scan_assets (scan_id);

create index if not exists idx_scan_assets_provider
  on public.scan_assets (provider);

create index if not exists idx_scan_assets_asset_type
  on public.scan_assets (asset_type);

-- Enable RLS
alter table public.scan_results enable row level security;
alter table public.scan_assets enable row level security;

-- Service role manages scan data
create policy "Service role manages scan_results"
  on public.scan_results for all using (true) with check (true);

create policy "Service role manages scan_assets"
  on public.scan_assets for all using (true) with check (true);
