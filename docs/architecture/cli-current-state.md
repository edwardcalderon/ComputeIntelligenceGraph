# CLI and Node Runtime: Current State

This is the implementation snapshot for the CLI and runtime work after the
first public CLI foundation release was prepared.

## What Exists

### CLI package

- Public npm package: `@cig-technology/cli`
- Tag-driven publish workflow: `cli-v*.*.*`
- Local release helper script under `packages/cli/scripts/release.sh`
- Package-local `@edcalderon/versioning` config, README guard, and prerelease helpers
- Command surface for auth, install, enroll, connect, status, open, upgrade, and uninstall

### Runtime-oriented groundwork

- `packages/runtime-contracts` defines shared node/profile/permission contracts
- `packages/node-runtime` exists as a Linux-first runtime skeleton
- CLI can stage a runtime bundle with config, identity, and a rendered `systemd` unit file

### API compatibility work

- enrollment accepts client-generated public keys
- CLI enrollment now generates Ed25519 keys locally

## What Works End-to-End Today

### Working locally

- publishable CLI package build/test/pack flow
- local credential and state persistence
- self-hosted compose generation
- self-hosted local stack startup attempt via Docker Compose
- managed login and enrollment request flow

### Partially working

- managed installs produce a local runtime bundle, but do not install it on a host
- `status`, `upgrade`, and `uninstall` operate on local saved state, not on a fully managed remote runtime
- `connect aws` and `connect gcp` store references only; they do not validate real cloud access

## What Does Not Exist Yet

- privileged Linux installer for `/etc/cig-node`, `/var/lib/cig-node`, and `cig-node.service`
- runtime graph-delta spool and offline queue
- connector worker supervision
- `/api/v1/nodes/*` control-plane contract
- node certificate rotation and revocation
- end-to-end permissions approval workflow
- remote SSH bootstrap

## Deployment Reality By Mode

### Self-hosted mode

Current behavior:

- CLI runs prerequisite checks
- generates compose files into the install directory
- starts the stack locally
- stores bootstrap token in the encrypted secrets store

Current gap:

- bootstrap-token hashing at the API side is still pending
- runtime-to-local-API sync is still pending

### Managed mode

Current behavior:

- operator authenticates with device flow
- CLI enrolls the target with a client-generated key pair
- install writes runtime assets into the local install directory

Current gap:

- no host installer
- no always-on runtime deployment
- no remote bootstrap flow

## Security State

Implemented now:

- encrypted local secrets store
- separate credentials file for AWS/GCP references
- local node private-key generation during enrollment

Still pending:

- OS keyring backend
- server-issued node certificate lifecycle
- connector-scoped secret management
- hardened bootstrap-token storage in self-hosted API persistence

## Operator Guidance

Treat the current system as a foundation release:

- good enough to install, test, and package the CLI
- good enough to exercise local self-hosted bootstrap and managed enrollment
- not yet complete enough for fully automated runtime rollout across Linux targets

The current source of truth for usage is:

- `packages/cli/src`
- `packages/node-runtime/src`
- `docs/reference/cli.md`
