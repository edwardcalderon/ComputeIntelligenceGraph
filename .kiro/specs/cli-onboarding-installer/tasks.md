# Implementation Tasks: CIG CLI + Node Runtime

## Overview

This task board tracks the current CLI and node-runtime implementation path.

The target remains:

- a production CLI bootstrapper/operator
- a persistent Linux-first `cig-node` runtime
- managed and self-hosted connection profiles
- layered permissions and connector expansion
- runtime-focused install, upgrade, and uninstall flows

The older installer-only board is no longer the source of truth for
auth/bootstrap/dashboard work. Those pieces were largely delivered under
`.kiro/specs/cig-auth-provisioning/`.

## Current Reality

- `packages/cli` now ships as a standalone npm package:
  `@cig-technology/cli`
- `packages/cli` has working commands for `login`, `logout`, `install`,
  `enroll`, `connect`, `permissions`, `status`, `open`, `upgrade`, and
  `uninstall`
- `packages/api` and `apps/dashboard` already implement device auth,
  enrollment, bootstrap, heartbeat, target listing, and OIDC callback flows
- `packages/runtime-contracts` and `packages/node-runtime` now exist in the
  monorepo as runtime groundwork
- managed mode currently stages runtime assets locally; it does not yet
  materialize a persistent host service on the target
- self-hosted mode currently generates compose assets and starts the local stack
  with Docker Compose

## Release State

- [x] Public CLI package metadata, README, release script, and publish workflow exist
- [x] Tag-driven release flow is established with `cli-v*.*.*`
- [x] `@cig-technology/cli@0.1.0` packaging was validated with build, test, and `npm pack --dry-run`
- [x] CLI package-local versioning, README guard, and prerelease scripts are wired into `packages/cli`
- [ ] Confirm npm registry publication and post-publish smoke install from the public registry

## Completed Baseline

- [x] CLI credential/state groundwork exists in `packages/cli`
- [x] API device authorization endpoints exist in `packages/api`
- [x] API enrollment, heartbeat, bootstrap, and OIDC routes exist
- [x] Dashboard device approval, bootstrap, and targets pages exist
- [x] Authentik OIDC hardening and device session persistence implemented (PR #7)
- [x] Cartography scan service foundation implemented (PR #7)
- [x] Installer compose generation and prerequisite checks exist
- [x] This task board has been rewritten to track the runtime architecture
- [x] CLI foundation release packaging exists for `@cig-technology/cli`
- [x] CLI/package/docs now describe the actual current behavior and known gaps

## Superseded Legacy Tasks

These are intentionally archived rather than re-tracked here:

- [x] Legacy Phases 1, 2, 4, and 5 from the original installer board are
      superseded by the delivered auth/bootstrap/targets work in
      `.kiro/specs/cig-auth-provisioning/`
- [x] The old installer board’s partial markers that duplicate already-landed
      API/dashboard functionality are retired
- [x] Future work is tracked by runtime milestone instead of week-based
      installer phases

## Active Milestones

- [~] 1. CLI foundation hardening
  - [x] 1.1 Add path-resolved CLI storage instead of hardcoded home-directory files
  - [x] 1.2 Add encrypted `CliSecretStore` fallback for auth/session/bootstrap material
  - [x] 1.3 Add `ConnectionProfileStore` for named control-plane/API profiles
  - [x] 1.4 Add authenticated `ApiClient` and use it from login/logout/enrollment/install flows
  - [x] 1.5 Fix CLI tests to use injectable temp paths instead of the real home directory
  - [ ] 1.6 Add OS keyring backend and seamless migration from encrypted-file fallback
  - [ ] 1.7 Add richer connection profile UX (`list`, `switch`, `delete`)
  - [x] 1.8 Publish the CLI as a standalone npm package under `@cig-technology`
  - [x] 1.9 Document current CLI behavior, storage paths, and setup flows
  - [x] 1.10 Add package-local `@edcalderon/versioning` support for validate/sync/README guard and prerelease workflows

- [~] 2. CLI command surface modernization
  - [x] 2.1 Add real `cig enroll` command
  - [x] 2.2 Replace top-level TODO handlers with store-backed `connect`, `status`, `open`, `upgrade`, and `uninstall` commands
  - [ ] 2.3 Implement `permissions grant/request/list` subcommands beyond the static tier summary
  - [ ] 2.4 Add `logs`, `restart`, `repair`, and connector lifecycle commands
  - [ ] 2.5 Improve `doctor` to validate runtime bundle, profiles, and managed auth readiness instead of only local Docker prerequisites

- [~] 3. Shared contracts and runtime package
  - [x] 3.1 Add `@cig/runtime-contracts` package with node, permission, connector, and profile types
  - [x] 3.2 Add `@cig/node-runtime` package skeleton
  - [x] 3.3 Add config/identity/status storage for the runtime
  - [x] 3.4 Add runtime supervisor skeleton with heartbeat timer, command poller, and discovery scheduler reuse
  - [x] 3.5 Add `systemd` unit rendering and staged runtime bundle generation from the CLI
  - [ ] 3.6 Add durable graph-delta queue and offline spool
  - [ ] 3.7 Add connector manager process supervision
  - [ ] 3.8 Add production install script/service registration for Linux hosts

- [~] 4. Managed enrollment and identity evolution
  - [x] 4.1 Update enrollment to accept client-generated node public keys while keeping backward compatibility
  - [x] 4.2 Move CLI enrollment to local Ed25519 key generation
  - [ ] 4.3 Replace legacy bearer validation in managed API routes with `@cig/auth/server` adapter selection
  - [ ] 4.4 Introduce `/api/v1/nodes/*` control-plane endpoints alongside compatibility shims
  - [ ] 4.5 Add node certificate/session issuance, revocation, and rotation
  - [ ] 4.6 Add long-poll command ACK/results flow

- [~] 5. Install/runtime split by mode
  - [x] 5.1 Update install planning so managed mode stages node runtime assets and self-hosted mode stages node + compose stack
  - [x] 5.2 Persist installation state through `StateManager`
  - [x] 5.3 Stage a `cig-node` bundle into the install directory
  - [ ] 5.4 Add privileged Linux installer for `/etc/cig-node`, `/var/lib/cig-node`, and `cig-node.service`
  - [ ] 5.5 Hash self-hosted bootstrap tokens at rest in the API/database layer
  - [ ] 5.6 Wire local node-to-local API sync for self-hosted mode
  - [ ] 5.7 Split stack manifest from node config manifest on the API side

- [ ] 6. Permission tiers and connectors
  - [ ] 6.1 Add persistent permission grants/requests models and API storage
  - [ ] 6.2 Implement AWS Tier 1 and Tier 2 validation/generation helpers
  - [ ] 6.3 Implement GCP Tier 1 and Tier 2 validation helpers
  - [ ] 6.4 Add connector manifests and local connector secret references
  - [ ] 6.5 Add dashboard/CLI approval flow for Tier 2+ requests

- [~] 7. Lifecycle, remote install, and packaging
  - [ ] 7.1 Wire `RemoteExecutor` into SSH-based remote Linux bootstrap
  - [ ] 7.2 Add runtime upgrade bundle rollout and rollback
  - [ ] 7.3 Add uninstall purge flow for self-hosted stack + runtime data
  - [x] 7.4 Add standalone CLI npm packaging, README, release script, and GitHub Actions publish workflow
  - [ ] 7.5 Add node runtime bundle packaging and release path
  - [ ] 7.6 Add Linux distribution validation matrix and runtime smoke tests

## Immediate Next Steps

- [ ] A. Add `/api/v1/nodes/*` compatibility layer and migrate the CLI/runtime to it
- [ ] B. Implement runtime status + graph delta upload persistence in `@cig/node-runtime`
- [ ] C. Implement Linux host installer that materializes the staged bundle into `/etc/cig-node`, `/var/lib/cig-node`, and `cig-node.service`
- [ ] D. Unify managed API auth onto `@cig/auth/server` instead of the legacy JWT-only path
- [ ] E. Verify the first npm release end-to-end from the public registry and add smoke-install notes

## Verification Gates

- [x] CLI package: build, lint, tests, and `npm pack --dry-run` pass with temp-path-based storage
- [x] New packages: `@cig/runtime-contracts` and `@cig/node-runtime` build cleanly
- [ ] Managed enrollment flow works end-to-end with client-generated node keys against a running API
- [ ] Self-hosted install still stages compose assets correctly
- [ ] Runtime bundle output includes config, identity, and systemd unit artifacts
