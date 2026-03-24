# @cig/infra

AWS deployment foundation for Compute Intelligence Graph.

This package now owns two related concerns:

- the TypeScript deployment wrapper and config surface used by the repo
- the SST runtime stack for the production API at `https://api.cig.technology`

## Ownership Boundary

- `packages/iac` owns stateful/shared API core data:
  - VPC
  - subnets
  - security groups
  - Neo4j instance and storage
- `packages/infra` owns runtime delivery:
  - ECR repository
  - ECS/Fargate service
  - ALB
  - ACM
  - Route53
  - optional native pipeline scaffolding

GitHub Actions is the primary production deployment entrypoint. Native SST pipeline creation remains optional and disabled during normal deploys.
The bootstrap helpers are safe to re-run: if the production SST stage already exists, they only ensure the ECR repository is present and do not prune the runtime stack.

## Key Files

- `sst.config.ts` — SST app entrypoint
- `infra.config.ts` — AWS API runtime definition
- `src/deployers/ApiDeployer.ts` — programmatic deploy wrapper for SST
- `src/deployers/apiRuntime.ts` — Terraform-output parsing and runtime config resolution
- `config/pipelines.example.json` — optional native pipeline config example

## API Config Surface

Programmatic/public types exported by this package:

- `ApiDeploymentConfig`
- `ApiDeploymentResult`
- `ApiRuntimeConfig`
- `ApiCoreTerraformOutputs`

Core runtime inputs:

- `API_DOMAIN`
- `API_IMAGE_REPOSITORY`
- `API_VPC_ID`
- `API_ALB_SECURITY_GROUP_ID`
- `API_PUBLIC_SUBNET_IDS`
- `API_PRIVATE_SUBNET_IDS`
- `API_SECURITY_GROUP_IDS`
- `API_DATABASE_URL_SECRET_ARN`
- `API_JWT_SECRET_ARN`
- `API_NEO4J_BOLT_URI`
- `API_NEO4J_PASSWORD_SECRET_ARN`
- `API_AUTHENTIK_ISSUER_URL_SECRET_ARN`
- `API_AUTHENTIK_JWKS_URI_SECRET_ARN`
- `API_AUTHENTIK_TOKEN_ENDPOINT_SECRET_ARN`
- `API_OIDC_CLIENT_ID_SECRET_ARN`
- `API_OIDC_CLIENT_SECRET_SECRET_ARN`
- `API_CORS_ORIGINS`
- `API_SMTP_HOST`
- `API_SMTP_PORT`
- `API_SMTP_SECURE`
- `API_SMTP_FROM_EMAIL`
- `API_SMTP_AUTH_ENABLED`
- `API_SMTP_OTP_SUBJECT`
- `API_SMTP_PASSWORD_SECRET_ARN`

Bootstrap-only mode uses:

- `INFRA_API_BOOTSTRAP_ONLY=true`
- `INFRA_CREATE_PIPELINES=false`

## Commands

```bash
pnpm --filter @cig/infra test
pnpm --filter @cig/infra build
pnpm --filter @cig/infra diff:api:prod
pnpm --filter @cig/infra bootstrap:api:prod
pnpm --filter @cig/infra deploy:api:prod
pnpm --filter @cig/infra bootstrap:api:pipelines
```

## Production Flow

1. Terraform in `packages/iac/environments/api-prod` applies networking and Neo4j.
2. GitHub Actions syncs runtime secrets into AWS Secrets Manager.
3. GitHub Actions ensures the ECR repository exists.
4. GitHub Actions builds and pushes the API image.
5. GitHub Actions runs `pnpm --filter @cig/api migrate:up` against Supabase Postgres.
6. GitHub Actions runs the full SST deploy for the ECS/Fargate runtime.
7. GitHub Actions runs health, authenticated REST, GraphQL, and WebSocket smoke checks.

## Related Docs

- [../iac/README.md](../iac/README.md)
- [../../docs/deployment/README.md](../../docs/deployment/README.md)
- [../../docs/deployment/api-aws.md](../../docs/deployment/api-aws.md)
