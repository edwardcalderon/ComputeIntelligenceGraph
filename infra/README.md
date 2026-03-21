# Infra Assets

The root `infra/` directory is reserved for non-TypeScript infrastructure assets.

- `infra/docker/` contains container build definitions.

Terraform modules are currently kept in `packages/iac/` because the TypeScript deployment wrapper in `packages/infra/` references that directory directly.
