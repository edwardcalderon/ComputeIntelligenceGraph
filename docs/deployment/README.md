# Deployment Notes

Last synchronized with the current release workflow on `2026-03-23`.

## Canonical Domains

| Surface | Origin | Purpose |
| --- | --- | --- |
| Landing | `https://cig.lat` | Public site and authentication entrypoint |
| Dashboard | `https://app.cig.lat` | Protected application UI |
| Authentik | `https://auth.cig.technology` | Identity provider and social-login broker |

## Current Deployment Surfaces

- `docker-compose.yml` for the full local or single-host stack
- `docker-compose.dev.yml` for development overrides
- `infra/docker/` for container build definitions
- `infra/docker/Dockerfile.dashboard` for the deployable dashboard container
- `packages/iac/` for Terraform modules and environment layouts
- `packages/infra/` for the TypeScript deployment wrapper used around infrastructure workflows

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

- GCP dashboard deployment: [gcloud-dashboard.md](gcloud-dashboard.md)
- Root overview: [../../README.md](../../README.md)
- Status snapshot: [../../PROJECT_STATUS.md](../../PROJECT_STATUS.md)
- Authentication runtime details: [../authentication/README.md](../authentication/README.md)

## Known Gaps

- Container publishing/distribution is still lightly documented
- A dedicated production environment-variable reference would still help
- `apps/wizard-ui` is still conservative to document because the product surface is minimal
- `packages/sdk` is not yet a deployable end-user surface
