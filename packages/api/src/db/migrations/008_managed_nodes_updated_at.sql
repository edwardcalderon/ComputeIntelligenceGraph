-- Migration: 008_managed_nodes_updated_at
-- Backfills managed_nodes.updated_at for databases created before the column
-- was moved out of 004_cig_node_onboarding.sql.

ALTER TABLE managed_nodes ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
