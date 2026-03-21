# Tasks: CIG Authentication & Provisioning

## Task List

- [x] 1. Auth Package — adapter factory and internal JWT
  - [x] 1.1 Create `packages/auth/src/adapters/oidc-adapter.ts` — OIDC adapter that validates ID tokens against Authentik JWKS endpoint
  - [x] 1.2 Create `packages/auth/src/adapters/local-jwt-adapter.ts` — local JWT adapter that validates tokens signed with `CIG_JWT_SECRET`
  - [x] 1.3 Create `packages/auth/src/create-auth-adapter.ts` — `createAuthAdapter(mode, config)` factory; no Supabase import when mode is not `supabase`
  - [x] 1.4 Create `packages/auth/src/internal-jwt.ts` — `createInternalToken` and `verifyInternalToken` (HMAC-SHA256, `iss: "cig-internal"`, 5-min TTL)
  - [x] 1.5 Update `packages/auth/src/index.ts` to export new adapter factory and internal JWT helpers
  - [x] 1.6 Write property tests for auth adapter (Properties 1, 2, 3) in `packages/auth/src/__tests__/auth-adapter.property.test.ts`
  - [x] 1.7 Write property tests for internal JWT round trip (Property 16) in `packages/auth/src/__tests__/internal-jwt.property.test.ts`

- [x] 2. IAC Package — Authentik AWS Terraform module
  - [x] 2.1 Create `packages/iac/modules/authentik-aws/variables.tf` — inputs: `vpc_id` (optional), `domain`, `region`, `db_instance_class`, `authentik_image_tag`, `route53_zone_id`
  - [x] 2.2 Create `packages/iac/modules/authentik-aws/main.tf` — VPC (conditional), RDS PostgreSQL, ECS Fargate cluster + task + service, ALB + HTTPS listener, ACM certificate, Route 53 record
  - [x] 2.3 Create `packages/iac/modules/authentik-aws/secrets.tf` — Secrets Manager secrets for admin password and DB credentials
  - [x] 2.4 Create `packages/iac/modules/authentik-aws/outputs.tf` — outputs: `issuer_url`, `oidc_client_id`, `oidc_client_secret` (sensitive)

- [x] 3. Infra Package — AuthentikInfraBlueprint
  - [x] 3.1 Extend `packages/infra/src/types.ts` with `AuthentikBlueprintResult` (adds `issuerUrl`, `oidcClientId`, `oidcClientSecret` to `AuthentikDeploymentResult`)
  - [x] 3.2 Implement `AuthentikDeployer.deploy()` stub methods using `IACIntegration.applyModule('authentik-aws', variables)` and read Terraform outputs
  - [x] 3.3 Implement rollback in `AuthentikDeployer.deploy()` — call `IACIntegration.destroyModule(...)` on any phase failure
  - [x] 3.4 Write property tests for blueprint outputs completeness and rollback (Properties 19, 20) in `packages/infra/src/__tests__/blueprint.property.test.ts`

- [x] 4. API — persistence layer setup
  - [x] 4.1 Create `packages/api/src/db/schema.ts` — TypeScript schema definitions for `managed_targets`, `enrollment_tokens`, `bootstrap_tokens`, `device_auth_records`, `audit_events`, `admin_accounts`
  - [x] 4.2 Create `packages/api/src/db/migrations/001_auth_provisioning.sql` — SQL migration for all new tables with indexes
  - [x] 4.3 Create `packages/api/src/db/client.ts` — database client setup (PostgreSQL via `pg` or SQLite via `better-sqlite3` based on `DATABASE_URL`)

- [x] 5. API — device authorization endpoints (Requirement 12)
  - [x] 5.1 Create `packages/api/src/routes/device-auth.ts` — `POST /api/v1/auth/device/authorize` (generate device_code, user_code, store with 15-min expiry)
  - [x] 5.2 Add `POST /api/v1/auth/device/poll` to device-auth routes — return `pending | approved | denied | expired`; include tokens when approved; rate-limit to 1 req/5s per device_code
  - [x] 5.3 Add `POST /api/v1/auth/device/approve` and `POST /api/v1/auth/device/deny` to device-auth routes — require authenticated Dashboard session
  - [x] 5.4 Add `POST /api/v1/auth/logout` — invalidate session token
  - [x] 5.5 Register device-auth routes in `packages/api/src/routes.ts`
  - [x] 5.6 Write property tests for device authorize response format (Property 4) in `packages/api/src/__tests__/device-auth.property.test.ts`
  - [x] 5.7 Write unit tests for full device auth lifecycle (approve, deny, expire, rate limit)

- [x] 6. API — target enrollment endpoints (Requirement 13)
  - [x] 6.1 Create `packages/api/src/routes/enrollment.ts` — `POST /api/v1/targets/enrollment-token` (UUID token, 10-min expiry, single-use)
  - [x] 6.2 Add `POST /api/v1/targets/enroll` — validate token, generate Ed25519 key pair + target_id, store public key, return private key once
  - [x] 6.3 Add `GET /api/v1/targets` — list Target_Nodes for authenticated user
  - [x] 6.4 Add `DELETE /api/v1/targets/:id` — invalidate Node_Identity, set status to `revoked`
  - [x] 6.5 Add `GET /api/v1/targets/install-manifest` — return `InstallManifest` JSON for given `target_id` and `profile`
  - [x] 6.6 Register enrollment routes in `packages/api/src/routes.ts`
  - [x] 6.7 Write property tests for enrollment token single-use invariant and key pair validity (Properties 7, 8) in `packages/api/src/__tests__/enrollment.property.test.ts`

- [x] 7. API — heartbeat endpoint (Requirement 14)
  - [x] 7.1 Create `packages/api/src/middleware/node-auth.ts` — Ed25519 signature verification middleware using `X-CIG-Signature` header
  - [x] 7.2 Create `packages/api/src/routes/heartbeat.ts` — `POST /api/v1/targets/:id/heartbeat`; verify signature, update `last_seen`, store metrics, emit WebSocket event `target:heartbeat`; rate-limit to 1 req/30s per target
  - [x] 7.3 Create `packages/api/src/jobs/heartbeat-monitor.ts` — background job running every 60s; set nodes to `degraded` (>5 min) or `offline` (>15 min)
  - [x] 7.4 Register heartbeat route and start background job in API startup
  - [x] 7.5 Write property tests for Ed25519 signature round trip (Property 15) in `packages/api/src/__tests__/heartbeat.property.test.ts`

- [x] 8. API — bootstrap endpoints (Requirement 15)
  - [x] 8.1 Create `packages/api/src/routes/bootstrap.ts` — `GET /api/v1/bootstrap/status`, `POST /api/v1/bootstrap/validate`, `POST /api/v1/bootstrap/complete`
  - [x] 8.2 Implement localhost-only guard for bootstrap endpoints in self-hosted mode
  - [x] 8.3 Register bootstrap routes in `packages/api/src/routes.ts`
  - [x] 8.4 Write property tests for bootstrap token single-use invariant and password validation (Properties 10, 11) in `packages/api/src/__tests__/bootstrap.property.test.ts`
  - [x] 8.5 Write unit test for bootstrap status endpoint returning `requires_bootstrap: true` with empty admin table

- [x] 9. API — OIDC callback endpoint (Requirement 16)
  - [x] 9.1 Create `packages/api/src/routes/oidc.ts` — `GET /api/v1/auth/oidc/callback`; exchange code for tokens, validate ID token via JWKS, upsert user record, issue CIG session token, redirect
  - [x] 9.2 Register OIDC route in `packages/api/src/routes.ts`
  - [x] 9.3 Write unit tests for OIDC callback: valid code, state mismatch (400), upstream error (502)

- [x] 10. API — audit logging (Requirement 18)
  - [x] 10.1 Create `packages/api/src/audit.ts` — `writeAuditEvent(event)` function; non-blocking (fire-and-forget with error logging on failure)
  - [x] 10.2 Add `GET /api/v1/audit` — paginated audit events for admin users
  - [x] 10.3 Instrument all auditable actions in device-auth, enrollment, heartbeat, bootstrap, and OIDC routes with `writeAuditEvent` calls
  - [x] 10.4 Write property tests for audit event completeness and non-blocking failure (Properties 17, 18) in `packages/api/src/__tests__/audit.property.test.ts`

- [x] 11. CLI — login and logout commands (Requirement 3)
  - [x] 11.1 Create `packages/cli/src/commands/login.ts` — POST to `/auth/device/authorize`, display user_code + verification_uri, poll at 5s intervals with exponential backoff on `slow_down`, store tokens via `CredentialManager`
  - [x] 11.2 Create `packages/cli/src/commands/logout.ts` — clear tokens and identity via `CredentialManager`, POST to `/auth/logout`
  - [x] 11.3 Register `cig login` and `cig logout` commands in `packages/cli/src/index.ts`
  - [x] 11.4 Write property tests for token storage round trip and refresh predicate (Properties 5, 6) in `packages/cli/src/__tests__/credentials.property.test.ts`

- [x] 12. CLI — prerequisite checks and doctor command (Requirement 7)
  - [x] 12.1 Create `packages/cli/src/prereqs.ts` — check functions for Docker Engine, Docker Compose v2, free memory (≥4 GB), free disk (≥10 GB), port availability (3000, 7474, 7687, 8000, 8080)
  - [x] 12.2 Create `packages/cli/src/commands/doctor.ts` — run all prereq checks, display readiness summary, exit 0 if all pass
  - [x] 12.3 Register `cig doctor` command in `packages/cli/src/index.ts`
  - [x] 12.4 Write property tests for prereq check correctness (Property 12) in `packages/cli/src/__tests__/prereqs.property.test.ts`

- [x] 13. CLI — compose generator (Requirement 7)
  - [x] 13.1 Create `packages/cli/src/compose-generator.ts` — generate `docker-compose.yml` and `.env` from `InstallManifest`; write `.env` with mode 0600; generate cryptographically random secrets for all services
  - [x] 13.2 Write property tests for compose generation completeness and secrets uniqueness (Properties 13, 14) in `packages/cli/src/__tests__/compose-generator.property.test.ts`

- [x] 14. CLI — install command (Requirements 4, 5, 6, 7)
  - [x] 14.1 Create `packages/cli/src/commands/install.ts` — orchestrate: prereq checks → mode branch (managed: enrollment flow; self-hosted: bootstrap flow) → profile selection → compose generation → `docker compose up -d` → health checks → write `~/.cig/state.json`
  - [x] 14.2 Implement managed enrollment sub-flow: POST enrollment-token → POST enroll → GET install-manifest → save Node_Identity
  - [x] 14.3 Implement self-hosted bootstrap sub-flow: generate Bootstrap_Token → save to `~/.cig/bootstrap.json` (0600) → display Dashboard URL and token
  - [x] 14.4 Implement rollback: on failure after services started, stop and remove CIG containers and generated config files
  - [x] 14.5 Create `packages/cli/src/commands/bootstrap-reset.ts` — generate new Bootstrap_Token, save, display
  - [x] 14.6 Register `cig install` and `cig bootstrap-reset` commands in `packages/cli/src/index.ts`
  - [x] 14.7 Write property tests for bootstrap token format (Property 9) in `packages/cli/src/__tests__/bootstrap-token.property.test.ts`

- [x] 15. Dashboard — device approval page (Requirement 9)
  - [x] 15.1 Create `apps/dashboard/app/device-approval/page.tsx` — list pending device auth requests (user_code, IP, timestamp); Approve/Deny buttons; auto-remove expired records; real-time updates via WebSocket or polling
  - [x] 15.2 Add notification badge to dashboard header when pending device auth requests exist for the current user

- [x] 16. Dashboard — managed targets page (Requirement 10)
  - [x] 16.1 Create `apps/dashboard/app/targets/page.tsx` — list Target_Nodes with hostname, OS, profile, status indicator (green/yellow/red), last heartbeat
  - [x] 16.2 Add detail panel (slide-out or modal) showing IP, architecture, services, CIG version, uptime
  - [x] 16.3 Add "Revoke Access" button per node; update status to `revoked` without full page reload
  - [x] 16.4 Write unit tests for status indicator rendering per node status value

- [x] 17. Dashboard — self-hosted bootstrap page (Requirement 11)
  - [x] 17.1 Create `apps/dashboard/app/bootstrap/page.tsx` — Bootstrap_Token input, validate via `POST /bootstrap/validate`, show admin account creation form on success, POST to `/bootstrap/complete`, redirect to login on success
  - [x] 17.2 Add bootstrap redirect logic to dashboard root layout: if `GET /bootstrap/status` returns `requires_bootstrap: true`, redirect unauthenticated routes to `/bootstrap`
  - [x] 17.3 Write unit tests for bootstrap page: redirect when required, error display on invalid token, redirect to login on completion

- [x] 18. Integration and end-to-end tests
  - [x] 18.1 Write integration test for full managed-mode login flow: authorize → approve → poll → tokens stored
  - [x] 18.2 Write integration test for full self-hosted install flow: bootstrap token generated → bootstrap/complete → session returned
  - [x] 18.3 Write integration test for full enrollment flow: enrollment-token → enroll → install-manifest
