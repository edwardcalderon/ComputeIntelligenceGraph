-- Migration: 006_demo_workspace_state
-- Tracks provisioning metadata for the shared demo workspace so the API can
-- keep the demo Neo4j/Chroma data persistent and reseed it safely.

CREATE TABLE IF NOT EXISTS demo_workspace_state (
  source TEXT PRIMARY KEY,
  seed_version TEXT NOT NULL,
  seeded_at TEXT NOT NULL,
  seeded_by TEXT NOT NULL,
  resource_count INTEGER NOT NULL DEFAULT 0,
  relationship_count INTEGER NOT NULL DEFAULT 0,
  semantic_collection TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS demo_workspace_state_seeded_at_idx
  ON demo_workspace_state (seeded_at DESC);
