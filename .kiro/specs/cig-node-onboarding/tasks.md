# Implementation Plan: CIG Node Onboarding & Installation Architecture

## Overview

Phased implementation of the full CIG Node onboarding system: Dashboard-led cloud connection
wizards, CLI install/enroll flow, persistent CIG Node runtime, AWS/GCP discovery, self-hosted
bootstrap, sensitive connector lifecycle, and hardening with property-based tests.

All TypeScript. Property-based tests use `fast-check`. Each property test must run ≥100 iterations
and carry a comment `// Feature: cig-node-onboarding, Property N: <title>`.

---

## Tasks

- [x] 1. Phase 1 — Dashboard Onboarding Intents + Manifest Generation
  - [x] 1.1 Define shared SDK types for SetupManifest, EnrollmentToken, NodeIdentity, GraphDelta, HeartbeatPayload
    - Create `packages/sdk/src/types.ts` with all exported interfaces from the design
    - Export TypeScript types shared between CLI, API, and Dashboard
    - _Requirements: 3.2, 18.1–18.10, 21.10_

  - [x] 1.2 Implement manifest serialization and signing utilities in packages/sdk
    - Create `packages/sdk/src/manifest.ts`: `serializeManifest`, `deserializeManifest`, `signManifest`, `verifyManifestSignature`
    - `serializeManifest` encodes to base64 URL-safe string; `deserializeManifest` decodes and validates schema version
    - `signManifest` computes HMAC-SHA256 over manifest body; `verifyManifestSignature` validates it
    - Throw descriptive errors on invalid/tampered/unsupported-version input
    - _Requirements: 3.3, 3.10, 21.1–21.9_

  - [ ]* 1.3 Write property tests for manifest serialization (Properties 4, 7, 8, 9)
    - **Property 4: Manifest Signature Round-Trip (Sign → Verify = True)** — `fc.record(manifestArb)` → sign → verify = true
    - **Property 7: Setup_Manifest Serialization Round-Trip** — `fc.record(manifestArb)` → serialize → deserialize → deep equal
    - **Property 8: Manifest Signature Tamper Detection** — mutate any field → verify = false
    - **Property 9: Invalid Manifest Deserialization Throws Descriptive Error** — `fc.string()` (non-manifest) → throws with message
    - _Requirements: 3.3, 3.10, 21.3, 21.4, 21.6, 21.9_

  - [x] 1.4 Implement Node_Identity signing utilities in packages/sdk
    - Create `packages/sdk/src/identity.ts`: `generateNodeIdentity`, `signRequest`, `verifySignature`
    - Use Node.js `crypto` module for Ed25519 key generation and signing
    - _Requirements: 7.1, 7.5, 14.3_

  - [x] 1.5 Implement ARN and GCP format validators in packages/sdk
    - Create `packages/sdk/src/validators.ts`: `validateRoleArn(arn: string)`, `validateGcpProjectId(id: string)`, `validateSaEmail(email: string)`
    - ARN pattern: `arn:aws:iam::<12-digit-account-id>:role/<role-name>`
    - GCP SA email pattern: `<name>@<project>.iam.gserviceaccount.com`
    - Return `{ valid: boolean; error?: string }` — never throw
    - _Requirements: 1.5, 1.6, 2.6_

  - [ ]* 1.6 Write property tests for format validators (Properties 1, 2)
    - **Property 1: ARN Format Validation** — `fc.string()` → accept iff matches ARN pattern
    - **Property 2: GCP Project ID and SA Email Format Validation** — `fc.string()` pairs → accept iff both match GCP patterns
    - _Requirements: 1.5, 1.6, 2.6_

  - [x] 1.7 Implement API data models and migrations for onboarding entities
    - Create Prisma schema (or equivalent ORM) in `packages/api/prisma/schema.prisma` for: OnboardingIntent, SetupManifestRecord, EnrollmentTokenRecord, ManagedNode, NodeIdentityRecord, BootstrapTokenRecord, HeartbeatRecord, ConnectorRequest, InstallationEvent, AuditEvent
    - _Requirements: 18.1–18.10_

  - [x] 1.8 Implement onboarding intent and manifest API endpoints
    - Create `packages/api/src/routes/onboarding.ts`
    - `POST /api/v1/onboarding/intents` — create OnboardingIntent, generate EnrollmentToken (UUID, bcrypt-hashed, 15-min TTL), sign SetupManifest, return manifest URL + CLI command string
    - `GET /api/v1/onboarding/intents/:id/manifest` — return signed SetupManifest for authenticated user's intent
    - `GET /api/v1/onboarding/intents/:id/status` — return current OnboardingStatus
    - All three require `requireHumanAuth` middleware; intent must belong to caller
    - _Requirements: 3.1–3.9, 17.1–17.3, 22.1_

  - [ ]* 1.9 Write property test for manifest field completeness (Property 3)
    - **Property 3: Setup_Manifest Field Completeness Invariant** — `fc.record(intentArb)` → generate manifest → all required fields present and non-null
    - _Requirements: 1.8, 3.1, 3.2_

  - [x] 1.10 Implement identity separation middleware in packages/api
    - Create `packages/api/src/middleware/auth.ts`: `requireHumanAuth` (Authentik JWT), `requireNodeAuth` (Ed25519 X-Node-Signature header), `requireBootstrapToken` (body token)
    - Each middleware must reject the other identity types with 401
    - Log all identity plane crossings as AuditEvent records
    - _Requirements: 14.1–14.10_

  - [ ]* 1.11 Write property test for identity plane separation (Property 15)
    - **Property 15: Identity Plane Separation** — node token on human endpoint → 401; human token on node endpoint → 401
    - _Requirements: 14.5, 14.6, 14.7, 7.9_

  - [x] 1.12 Build AWS onboarding wizard UI in apps/dashboard
    - Create `apps/dashboard/app/(dashboard)/onboarding/aws/page.tsx` — multi-step wizard
    - Step 1: IAM trust policy JSON (copyable), permission policy JSON (copyable), expected ARN format
    - Step 2: Role ARN input with inline validation using `validateRoleArn` from packages/sdk
    - Step 3: Display generated CLI command with manifest URL; poll `/intents/:id/status` every 10s via SSE
    - _Requirements: 1.1–1.10_

  - [x] 1.13 Build GCP onboarding wizard UI in apps/dashboard
    - Create `apps/dashboard/app/(dashboard)/onboarding/gcp/page.tsx` — multi-step wizard
    - Step 1: SA impersonation instructions; fallback narrowly-scoped SA setup with warning; minimum IAM roles
    - Step 2: Project ID + SA email inputs with inline validation; no raw JSON key upload as primary path
    - Step 3: Display generated CLI command; poll status via SSE
    - _Requirements: 2.1–2.10_

  - [x] 1.14 Build onboarding progress tracker page in apps/dashboard
    - Create `apps/dashboard/app/(dashboard)/onboarding/[intentId]/page.tsx`
    - Display state machine progress: draft → manifest_ready → cli_started → node_enrolled → credential_validated → discovery_started → online
    - Connect to SSE endpoint for real-time status pushes; show error states with recovery actions
    - On "online": show success screen with link to `/nodes/:id`
    - _Requirements: 1.10, 2.9, 22.1–22.10_

  - [x] 1.15 Checkpoint — Ensure all Phase 1 tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [x] 2. Phase 2 — CLI Real Install/Enroll Flow
  - [x] 2.1 Scaffold CLI package entry point and command registry
    - Create `packages/cli/src/index.ts` with commander.js (or equivalent) root program
    - Register all top-level commands: login, logout, install, enroll, status, doctor, open, permissions, upgrade, uninstall, bootstrap-reset
    - Wire global flags: `--mode`, `--cloud`, `--profile`, `--target`, `--manifest`, `--token`
    - _Requirements: 4.1–4.16_

  - [x] 2.2 Implement `cig login` and `cig logout` commands
    - Create `packages/cli/src/commands/login.ts`: Authentik OIDC device authorization flow using `packages/auth`
    - Create `packages/cli/src/commands/logout.ts`: clear stored tokens via `clearTokens()`
    - Store Authentik access token for subsequent Dashboard API calls
    - _Requirements: 4.1, 4.2, 12.4, 12.5_

  - [x] 2.3 Implement `cig doctor` command
    - Create `packages/cli/src/commands/doctor.ts`
    - Check: Docker available, Docker Compose available, network reachability to control plane endpoint
    - For `--target ssh`: validate SSH key path exists and host is reachable
    - Print pass/fail per check with remediation steps; exit 0 only if all pass
    - _Requirements: 4.6, 5.7, 5.8_

  - [x] 2.4 Implement manifest fetch, decode, and signature verification in CLI
    - Create `packages/cli/src/manifest.ts`
    - Accept `--manifest` as URL (fetch via authenticated GET) or inline base64 (decode directly)
    - Call `verifyManifestSignature`; abort with clear error if invalid — write nothing to disk
    - Check `expiresAt`; abort with expiry message if past
    - _Requirements: 5.1, 5.2, 21.7_

  - [ ]* 2.5 Write property test for CLI manifest rejection (Property 10)
    - **Property 10: CLI Rejects Manifests with Invalid Signatures** — `fc.record(manifestArb)` → tamper any field → CLI install aborts, no partial state written
    - _Requirements: 5.1, 5.2_

  - [x] 2.6 Implement or update the actual Docker Compose and .env file generation in packages/infra
    - Create `packages/infra/src/compose.ts`: `generateComposeFile(manifest, profile)` — renders core or full compose YAML from design template
    - Create `packages/infra/src/install.ts`: `writeIdentityFile`, `readIdentityFile`, `writeBootstrapToken` with 0600 permissions
    - `INSTALL_DIR = /opt/cig-node`; identity file encrypted with passphrase derived from node UUID
    - _Requirements: 5.9, 6.1, 6.2, 7.4_

  - [ ]* 2.7 Write property test for Node_Identity persistence round-trip (Property 11)
    - **Property 11: Node_Identity Persistence Round-Trip** — `fc.record(identityArb)` → writeIdentityFile → readIdentityFile → deep equal on nodeId, privateKey, publicKey
    - _Requirements: 6.2, 7.4, 7.7_

  - [x] 2.8 Implement SSH target support in packages/cli
    - Create `packages/cli/src/ssh.ts`: establish SSH connection using `ssh2` library, upload compose files, run `docker compose up -d` remotely
    - Support key-based auth; prompt for password if no key available
    - _Requirements: 5.4, 5.5_

  - [x] 2.9 Implement `cig install` command
    - Create or update the actual `packages/cli/src/commands/install.ts`
    - Orchestrate: fetch manifest → verify signature → run doctor checks → generate compose + env files → write to install dir → `docker compose up -d` (local or via SSH) → poll node health → exit
    - For `--target host`: assume running on target, install locally
    - CLI exits after confirming node is healthy — it is not the discovery engine
    - _Requirements: 5.1–5.10, 4.3_

  - [x] 2.10 Implement `cig enroll` command
    - Create `packages/cli/src/commands/enroll.ts`
    - Accept `--token` (Enrollment_Token) and `--node-id`; call `POST /api/v1/nodes/enroll`; write returned NodeIdentity to identity file
    - _Requirements: 4.4, 7.3, 7.4_

  - [x] 2.11 Implement `cig status`, `cig permissions`, `cig upgrade`, `cig uninstall` commands
    - `status`: call `GET /api/v1/nodes/:id` and print health summary
    - `permissions`: call API for current tier; print tier, active permissions, next-tier policy JSON
    - `upgrade`: pull new images, `docker compose pull && docker compose up -d`
    - `uninstall`: `docker compose down`; optionally `docker volume rm` with `--purge` flag
    - _Requirements: 4.5, 4.8, 4.9, 4.10, 11.10_

  - [x] 2.12 Checkpoint — Ensure all Phase 2 tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Phase 3 — CIG Node Runtime v1
  - [x] 3.1 Implement node enrollment API endpoint
    - Create `packages/api/src/routes/nodes/enroll.ts`
    - `POST /api/v1/nodes/enroll`: validate EnrollmentToken (not expired, not used), generate NodeIdentity (UUID + Ed25519 key pair via `generateNodeIdentity`), store public key in NodeIdentityRecord, mark token as used, return private key exactly once (never stored server-side)
    - Transition OnboardingIntent to `node_enrolled`; record InstallationEvent
    - _Requirements: 7.1–7.3, 7.10, 3.4, 3.5, 22.4_

  - [ ]* 3.2 Write property tests for enrollment (Properties 5, 6, 13)
    - **Property 5: Enrollment Token Single-Use Invariant** — enroll twice with same token → second returns 401
    - **Property 6: Enrollment Token Expiry Invariant** — `fc.date()` past expiry → enroll → 401
    - **Property 13: Node Enrollment Produces Complete NodeIdentity** — valid token → enroll → nodeId, privateKey, publicKey all non-empty; stored public key matches returned
    - _Requirements: 3.4, 3.5, 3.6, 7.1, 7.2_

  - [x] 3.3 Implement heartbeat API endpoint
    - Create `packages/api/src/routes/nodes/heartbeat.ts`
    - `POST /api/v1/nodes/:id/heartbeat`: validate Ed25519 signature via `requireNodeAuth`, validate permissionTier in [0,4], update node `lastSeenAt`, store HeartbeatRecord, emit SSE event to Dashboard clients
    - Rate-limit to 1 request per 30 seconds per node (return 429 if exceeded)
    - _Requirements: 16.1–16.10, 17.5_

  - [ ]* 3.4 Write property tests for heartbeat (Properties 12, 17, 20)
    - **Property 12: Heartbeat Signed with Node Private Key** — `fc.record(heartbeatArb)` → sign with private key → API accepts iff signature valid
    - **Property 17: Heartbeat Permission Tier in Valid Range** — tier in [0,4] → accepted; outside → rejected
    - **Property 20: Heartbeat Rate Limiting** — two heartbeats < 30s apart → second returns 429
    - _Requirements: 6.4, 16.1, 16.9, 11.8_

  - [x] 3.5 Implement node status staleness checker
    - Create `packages/api/src/jobs/nodeStatusChecker.ts` — runs every minute
    - If `lastSeenAt` > 5 min ago: set status `degraded`, push Dashboard notification
    - If `lastSeenAt` > 15 min ago: set status `offline`, push Dashboard alert
    - When heartbeat arrives for offline node: set status `online`
    - _Requirements: 16.3–16.6_

  - [ ]* 3.6 Write property test for node status from heartbeat age (Property 19)
    - **Property 19: Node Status Reflects Heartbeat Age** — `fc.integer()` (elapsed minutes) → <5 min: online; 5–15 min: degraded; >15 min: offline; heartbeat after offline → online
    - _Requirements: 16.4, 16.5, 16.6_

  - [x] 3.7 Implement node revocation endpoint and revocation enforcement
    - `DELETE /api/v1/nodes/:id` (requireHumanAuth, node must belong to caller): set `NodeIdentityRecord.revokedAt`, set node status `revoked`
    - Update `requireNodeAuth` middleware to reject all requests from nodes with `revokedAt` set (return 401)
    - _Requirements: 7.8, 14.9_

  - [ ]* 3.8 Write property test for node revocation (Property 14)
    - **Property 14: Node Revocation Rejects All Subsequent Requests** — enroll → revoke → heartbeat/graph-delta/connector → all return 401
    - _Requirements: 7.8_

  - [x] 3.9 Implement graph-delta API endpoint
    - Create `packages/api/src/routes/nodes/graphDelta.ts`
    - `POST /api/v1/nodes/:id/graph-delta` (requireNodeAuth): validate signature, call `applyDelta` from packages/graph, record InstallationEvent
    - _Requirements: 8.9, 8.10, 17.6_

  - [x] 3.10 Implement node list endpoint and node detail page in apps/dashboard
    - `GET /api/v1/nodes` (requireHumanAuth): list all nodes for authenticated user
    - Create `apps/dashboard/app/(dashboard)/nodes/page.tsx` — node list with color status indicators (green/yellow/red/grey)
    - Create `apps/dashboard/app/(dashboard)/nodes/[id]/page.tsx` — node detail: health metrics, permission tier, active connectors
    - _Requirements: 12.7, 16.7, 17.7_

  - [x] 3.11 Implement SSE push for real-time node status updates
    - Create `packages/api/src/sse/nodeStatus.ts` — SSE endpoint that streams node status change events to Dashboard
    - Connect Dashboard status pages to SSE stream; update UI on event receipt
    - _Requirements: 12.8, 16.10_

  - [x] 3.12 Implement exponential backoff retry in CIG Node runtime
    - Create `packages/discovery/src/retry.ts`: `withExponentialBackoff(fn, delays=[5,10,20,40,60])` — doubles delay up to 60s cap
    - Use in all control plane HTTP calls from the node runtime
    - _Requirements: 12.9, 12.10_

  - [ ]* 3.13 Write property test for exponential backoff sequence (Property 18)
    - **Property 18: Retry Exponential Backoff Sequence** — mock N failures → check delay sequence is [5,10,20,40,60,60,...] seconds
    - _Requirements: 12.9_

  - [~] 3.14 Checkpoint — Ensure all Phase 3 tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Phase 4 — AWS Onboarding and Discovery
  - [~] 4.1 Implement AWS discovery adapter in packages/discovery
    - Create `packages/discovery/src/aws/adapter.ts`: `AWSDiscoveryAdapter` implementing `assumeRole`, `subscribeCloudTrail`, `fetchResource`
    - `assumeRole`: call AWS STS with role ARN + external ID; session max 1 hour; auto-renew before expiry
    - Never accept long-lived access key/secret key as primary path; use SDK default credential chain as fallback
    - _Requirements: 9.1–9.4, 9.10_

  - [~] 4.2 Implement Tier 1 AWS IAM policy constants and documentation
    - Create `packages/discovery/src/aws/permissions.ts`: export `TIER1_POLICY_JSON` (read-only Describe/List for EC2, RDS, S3, Lambda, VPC, IAM), `TIER2_POLICY_JSON`, trust policy template with external ID condition
    - These are displayed in the Dashboard onboarding wizard and `cig permissions` output
    - _Requirements: 1.2, 1.3, 9.5, 9.6, 11.1–11.3_

  - [~] 4.3 Implement Cartography-based initial full scan for AWS
    - Create `services/cartography/src/aws/fullScan.ts`: invoke Cartography with AssumeRole credentials; enumerate all Tier 1 resource types; produce GraphDelta of type `full`
    - Emit GraphDelta to `POST /api/v1/nodes/:id/graph-delta` on completion
    - Transition OnboardingIntent to `discovery_started` then `online` after first heartbeat
    - _Requirements: 8.1–8.3, 6.5, 6.6, 22.6, 22.7_

  - [~] 4.4 Implement CloudTrail event subscription and targeted delta emission
    - Create `packages/discovery/src/aws/cloudtrail.ts`: subscribe to CloudTrail event stream; on resource create/modify/delete, call `fetchResource` and emit targeted GraphDelta within 60 seconds
    - Do not perform full re-scan on every event — only fetch affected resource(s)
    - _Requirements: 6.7, 6.8, 8.4–8.6_

  - [~] 4.5 Implement 6-hour reconciliation scheduler for AWS
    - Create `packages/discovery/src/scheduler.ts`: schedule full reconciliation scan every 6 hours
    - On drift detected, emit GraphDelta of type `drift` containing only changed resources
    - _Requirements: 6.9, 8.7, 8.8_

  - [~] 4.6 Implement AWS credential error reporting
    - When `assumeRole` fails: set node status `credential-error` via `POST /api/v1/nodes/:id/status`, report error details
    - Dashboard displays `credential-error` with link to IAM setup guide
    - _Requirements: 9.7, 9.8_

  - [~] 4.7 Implement graph delta application in packages/graph
    - Create `packages/graph/src/delta.ts`: `applyDelta(delta: GraphDelta, neo4j: Neo4jDriver)` — apply additions, modifications, deletions to Neo4j
    - Create `packages/graph/src/neo4j.ts`: `createNeo4jDriver(uri, auth)`
    - _Requirements: 8.9, 8.10_

  - [~] 4.8 Checkpoint — Ensure all Phase 4 tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Phase 5 — GCP Onboarding and Discovery
  - [~] 5.1 Implement GCP discovery adapter in packages/discovery
    - Create `packages/discovery/src/gcp/adapter.ts`: `GCPDiscoveryAdapter` implementing `impersonateServiceAccount`, `subscribeAuditLog`, `fetchResource`
    - `impersonateServiceAccount`: obtain short-lived access tokens via IAM credentials API; refresh before expiry
    - Fallback: narrowly-scoped SA with JSON key file stored encrypted in install dir (not primary path)
    - Validate GCP credentials with lightweight test API call during enrollment before reporting success
    - _Requirements: 10.1–10.4, 10.10_

  - [~] 5.2 Implement Tier 1 GCP IAM role constants and documentation
    - Create `packages/discovery/src/gcp/permissions.ts`: export `TIER1_ROLES` (roles/viewer or equivalent custom role for Compute, CloudSQL, GCS, CloudFunctions, VPC, IAM), impersonation setup instructions
    - _Requirements: 2.3–2.5, 10.5, 11.2_

  - [~] 5.3 Implement Cartography-based initial full scan for GCP
    - Create `services/cartography/src/gcp/fullScan.ts`: invoke Cartography with impersonated SA credentials; enumerate all Tier 1 GCP resource types; produce GraphDelta of type `full`
    - Emit GraphDelta to control plane on completion; transition intent states
    - _Requirements: 8.1–8.3, 6.5, 6.6_

  - [~] 5.4 Implement GCP Audit Log subscription and targeted delta emission
    - Create `packages/discovery/src/gcp/auditlog.ts`: subscribe to GCP Audit Log sink; on resource create/modify/delete, call `fetchResource` and emit targeted GraphDelta within 60 seconds
    - _Requirements: 6.7, 6.8, 8.4–8.6_

  - [~] 5.5 Implement GCP credential error reporting
    - When `impersonateServiceAccount` fails: set node status `credential-error`, report to control plane
    - Dashboard displays `credential-error` with link to GCP setup guide
    - _Requirements: 10.6, 10.7_

  - [~] 5.6 Checkpoint — Ensure all Phase 5 tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Phase 6 — Self-Hosted Bootstrap
  - [x] 6.1 Implement and check actual bootstrap token generation and storage in packages/infra
    - Extend `packages/infra/src/install.ts`: `generateBootstrapToken()` — 32-char cryptographically random string
    - Write to `BOOTSTRAP_TOKEN_FILE` with 0600 permissions; display to operator once after install
    - _Requirements: 13.2, 13.3_

  - [x] 6.2 Implement bootstrap API endpoints in packages/api
    - Create `packages/api/src/routes/bootstrap.ts`
    - `GET /api/v1/bootstrap/status` (no auth): return `{ bootstrapRequired: boolean }` based on whether any admin accounts exist
    - `POST /api/v1/bootstrap/init` (localhost-only, no auth): generate and store BootstrapTokenRecord (bcrypt-hashed, 30-min TTL from first Dashboard access)
    - `POST /api/v1/bootstrap/complete` (requireBootstrapToken): validate token, create admin account, invalidate token, return session
    - No Authentik dependency — local API handles admin account creation and session management
    - _Requirements: 13.4–13.7, 17.10–17.12_

  - [ ]* 6.3 Write property test for bootstrap token scoping (Property 16)
    - **Property 16: Bootstrap Token Rejected on Non-Bootstrap Endpoints** — valid bootstrap token on any endpoint other than `POST /api/v1/bootstrap/complete` → 401 or 403
    - _Requirements: 14.8_

  - [x] 6.4 Implement and upgrade self-hosted bootstrap page in apps/dashboard
    - Create `apps/dashboard/app/bootstrap/page.tsx`
    - On first access: call `GET /api/v1/bootstrap/status`; if `bootstrapRequired: true`, show bootstrap page (no Authentik)
    - Bootstrap page: Bootstrap_Token input → admin account creation form → on success, redirect to login
    - _Requirements: 13.4–13.6_

  - [x] 6.5 Implement `cig install --mode self-hosted` path in CLI
    - Extend `packages/cli/src/commands/install.ts` for self-hosted mode
    - Install full CIG control plane stack (API, Neo4j, Dashboard, Discovery, Cartography) via Docker Compose
    - Generate Bootstrap_Token, write to install dir, display to operator
    - Implement `cig bootstrap-reset` command: generate new Bootstrap_Token, overwrite file
    - _Requirements: 13.1, 13.2, 13.8_

  - [x] 6.6 Wire self-hosted CIG Node to local API endpoint
    - When `--mode self-hosted`: set `controlPlaneEndpoint` in SetupManifest to `http://localhost:3003` (or configured local URL)
    - Self-hosted stack must be fully functional for discovery, graph updates, and Dashboard without outbound connection to CIG cloud
    - _Requirements: 13.9, 13.10_

  - [x] 6.7 Checkpoint — Ensure all Phase 6 tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Phase 7 — Sensitive Connector Approval/Install Flow
  - [~] 7.1 Implement connector request and approval API endpoints
    - Create `packages/api/src/routes/nodes/connectors.ts`
    - `POST /api/v1/nodes/:id/connectors` (requireHumanAuth): create ConnectorRequest record (status: pending), return request ID
    - `PATCH /api/v1/nodes/:id/connectors/:connectorId` (requireHumanAuth): approve or reject; on approval, set `approvedAt`, notify CIG Node via SSE/polling
    - `GET /api/v1/nodes/:id/connectors` (requireHumanAuth): list active connectors with permission scope and last-used timestamp
    - `DELETE /api/v1/nodes/:id/connectors/:connectorId` (requireHumanAuth): revoke connector
    - _Requirements: 15.3, 15.7, 17.9_

  - [~] 7.2 Implement connector lifecycle in CIG Node runtime
    - Create `packages/discovery/src/connectors/manager.ts`: `ConnectorManager` — polls control plane for approved connector requests; installs connector using dedicated scoped credentials (NOT by expanding base IAM role/SA)
    - Store connector credentials encrypted in install dir, separate from base cloud credentials
    - On connector uninstall: delete dedicated credentials, notify control plane
    - On credential expiry/invalidity: report error to control plane, disable connector
    - Connectors run as isolated sub-processes with their own credential context
    - _Requirements: 15.4, 15.5, 15.6, 15.9, 15.10_

  - [~] 7.3 Build connector approval UI in apps/dashboard
    - Create `apps/dashboard/app/(dashboard)/nodes/[id]/connectors/page.tsx`
    - Display pending connector requests with exact additional permissions required and data description
    - Approve/reject buttons; list active connectors with scope and last-used timestamp
    - No connector enabled by default
    - _Requirements: 15.1, 15.2, 15.8_

  - [~] 7.4 Checkpoint — Ensure all Phase 7 tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Phase 8 — Hardening, Tests, Docs
  - [~] 8.1 Write remaining property-based tests for API state machine (Properties 21, 22)
    - **Property 21: Onboarding State Machine Valid Transitions** — `fc.constantFrom(...states)` → invalid forward jumps (e.g., draft → online) rejected with 409; only valid sequential transitions accepted
    - **Property 22: Error State Re-Entry Allowed** — intent in error state → retry transition to preceding non-error state → accepted without creating new intent
    - Place tests in `packages/api/src/__tests__/stateMachine.property.test.ts`
    - _Requirements: 22.1, 22.2, 22.3_

  - [~] 8.2 Write property-based tests for bootstrap token and identity separation (Properties 15, 16 — additional coverage)
    - Extend `packages/api/src/__tests__/auth.property.test.ts`
    - Verify bootstrap token rejected on all non-bootstrap endpoints across all route groups
    - Verify node identity rejected on all human-facing routes; human JWT rejected on all node-facing routes
    - _Requirements: 14.5–14.8_

  - [~] 8.3 Write unit tests for all API endpoints (happy path + error conditions)
    - Create `packages/api/src/__tests__/onboarding.test.ts`, `nodes.test.ts`, `bootstrap.test.ts`
    - One concrete happy-path example per endpoint; one error-condition example per error table entry in design
    - Test error message content and format matches design error table
    - _Requirements: 17.1–17.12_

  - [~] 8.4 Write unit tests for CLI commands
    - Create `packages/cli/src/__tests__/install.test.ts`, `doctor.test.ts`, `enroll.test.ts`
    - One concrete example per CLI command; test abort behavior on invalid manifest; test SSH path with mock
    - _Requirements: 4.1–4.16, 5.1–5.10_

  - [ ]* 8.5 Write integration tests for full onboarding flow (E2E)
    - Create `packages/api/src/__tests__/e2e/onboarding.e2e.test.ts`
    - Full flow: create intent → generate manifest → CLI fetches manifest → node enrolls → heartbeat → status = online
    - Use Docker Compose test environment with mock AWS/GCP credential endpoints
    - _Requirements: 20.8_

  - [ ]* 8.6 Write integration tests for self-hosted bootstrap flow (E2E)
    - Create `packages/api/src/__tests__/e2e/bootstrap.e2e.test.ts`
    - Flow: `cig install --mode self-hosted` → bootstrap page → admin creation → login
    - _Requirements: 20.8, 13.1–13.10_

  - [ ]* 8.7 Write integration tests for Node_Identity round-trip and security boundaries (E2E)
    - Create `packages/api/src/__tests__/e2e/identity.e2e.test.ts`
    - Enroll → persist identity → simulate restart → re-authenticate with same identity
    - Attempt all identity plane crossings (node token on human endpoint, human JWT on node endpoint, bootstrap token on wrong endpoint) — all must fail
    - _Requirements: 20.8, 14.1–14.10_

  - [~] 8.8 Validate file permission assertions for identity and bootstrap token files
    - Add assertions in `packages/infra/src/__tests__/install.test.ts` that identity file and bootstrap token file are created with mode 0600
    - _Requirements: 7.4, 13.3_

  - [~] 8.9 Implement permission tier tracking and reporting
    - Extend HeartbeatRecord processing: update `ManagedNode.permissionTier` from heartbeat payload
    - Extend `cig permissions` output: current tier, active permissions list, policy JSON for next tier upgrade
    - Dashboard node detail page: display current permission tier with upgrade instructions
    - _Requirements: 11.7, 11.8, 11.10_

  - [~] 8.10 Implement audit event logging for all identity plane crossings and state transitions
    - Ensure all `requireHumanAuth`, `requireNodeAuth`, `requireBootstrapToken` middleware write AuditEvent on rejection
    - Ensure all OnboardingIntent state transitions write InstallationEvent records
    - _Requirements: 14.10, 22.10_

  - [~] 8.11 Final checkpoint — Ensure all tests pass
    - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with ≥100 iterations each, tagged `// Feature: cig-node-onboarding, Property N: <title>`
- Unit tests cover one concrete example per endpoint/command plus error conditions — they do not duplicate property test coverage
- Checkpoints at the end of each phase ensure incremental validation before the next phase begins
- `apps/wizard-ui` is deprecated; all onboarding UI lives in `apps/dashboard`
