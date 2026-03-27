-- Migration: 005_graph_tenancy
-- Adds tenant/workspace scoping to onboarding and managed node records so
-- graph ingestion and query layers can isolate managed tenants/workspaces.

ALTER TABLE onboarding_intents
  ADD COLUMN tenant TEXT;

ALTER TABLE managed_nodes
  ADD COLUMN tenant TEXT;

CREATE INDEX IF NOT EXISTS onboarding_intents_tenant_idx ON onboarding_intents (tenant);
CREATE INDEX IF NOT EXISTS managed_nodes_tenant_idx ON managed_nodes (tenant);
