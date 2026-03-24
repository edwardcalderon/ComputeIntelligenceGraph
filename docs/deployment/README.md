# Deployment Notes

Last synchronized with the current release workflow on `2026-03-23`.

## Canonical Domains

| Surface | Origin | Purpose |
| --- | --- | --- |
| Landing | `https://cig.lat` | Public site and authentication entrypoint |
| Dashboard | `https://app.cig.lat` | Protected application UI |
| API | `https://api.cig.technology` | Canonical public API origin and AWS provisioning target |
| Authentik | `https://auth.cig.technology` | Identity provider and social-login broker |

## Current Deployment Surfaces

- `docker-compose.yml` for the full local or single-host stack
- `docker-compose.dev.yml` for development overrides
- `infra/docker/` for container build definitions
- `infra/docker/Dockerfile.dashboard` for the deployable dashboard container
- `infra/docker/Dockerfile.api` for the deployable Fastify API container
- `packages/iac/` for Terraform modules and environment layouts
- `packages/infra/` for the TypeScript deployment wrapper plus the SST AWS runtime stack

## Provisioning Direction

- Provision the standalone API package as the public application API at `api.cig.technology`
- Keep dashboard-only web bridges inside the dashboard deployable surface, not as a second domain API
- Treat health, readiness, metrics, and CORS policy as API deployment concerns owned by `packages/api`
- Keep stateful API core data in Terraform under `packages/iac`
- Keep runtime delivery in SST under `packages/infra`
- Use GitHub Actions as the authoritative production delivery path, with native SST pipeline creation kept manual and disabled by default

## Primary Services in the Local Stack

- Neo4j
- Chroma
- API
- Chatbot
- Discovery
- Dashboard
- Cartography

## Release Build Verification

The repository release workflow currently verifies:

- landing production build
- dashboard production container build
- wizard UI production build

That verification is performed by `scripts/release.sh` during patch, minor, and major releases.

## Related Deployment Docs

- API on AWS: [api-aws.md](api-aws.md)
- GCP dashboard deployment: [gcloud-dashboard.md](gcloud-dashboard.md)
- Root overview: [../../README.md](../../README.md)
- Status snapshot: [../../PROJECT_STATUS.md](../../PROJECT_STATUS.md)
- Authentication runtime details: [../authentication/README.md](../authentication/README.md)

## Current Constraints

- The API production runtime is intentionally single-task (`desiredCount=1`) until WebSocket fan-out and heartbeat work move out of process
- Supabase Postgres remains external; it is not provisioned by Terraform in this repo
- Native SST pipeline resources are optional follow-up infrastructure and are not mutated during normal production deploys
- `packages/sdk` is a shared client layer, not a deployable runtime surface
