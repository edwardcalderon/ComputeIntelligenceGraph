# Deployment Notes

## Current Deployment Surface

- `docker-compose.yml` for the full local or single-host stack
- `docker-compose.dev.yml` for development overrides
- `infra/docker/` for container build definitions
- `packages/iac/` for Terraform module scaffolding used by `packages/infra`

## Primary Services in Compose

- Neo4j
- Chroma
- API
- Chatbot
- Discovery
- Dashboard
- Cartography

## Domain Notes

- Primary public domain: `https://cig.lat`
- Legacy GitHub Pages base-path support exists only when explicitly enabled for the landing app

## Gaps

- Container publishing workflow is not documented here yet
- Production environment variable reference still needs a dedicated document
- Landing and wizard deployment docs should stay conservative until those apps are feature-complete
