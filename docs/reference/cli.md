# CLI Reference

This document describes how to use the current `@cig-technology/cli`
foundation release as it exists in the repository today.

## Purpose

The CLI is the bootstrap and operator surface for CIG. It is responsible for:

- authenticating the operator
- staging installs
- generating or requesting initial bootstrap material
- storing local session and install metadata
- reporting local status

It is not the persistent graph-maintenance process. That responsibility is
intended to move into `cig-node`.

## Supported Flows Today

### Managed mode

Supported today:

- device authorization login
- enrollment request against the API
- local node key generation
- managed connection-profile storage
- staging of runtime bundle assets into the local install directory

Not supported today:

- automatic remote installation on a Linux target
- automatic `systemd` registration on the target host
- full `/api/v1/nodes/*` command-and-control lifecycle

### Self-hosted mode

Supported today:

- bootstrap token generation
- compose manifest generation
- local `docker compose up -d`
- health polling against the local stack
- local install-state persistence

Not supported today:

- hashed bootstrap-token persistence on the API side
- node-to-local-API runtime sync
- complete separation between stack manifest and node config manifest

## Install and Run

Install from npm:

```bash
npm install -g @cig-technology/cli
```

Or run with `npx`:

```bash
npx @cig-technology/cli login --api-url https://app.cig.lat
```

## Package Maintenance

The CLI package now has package-local `@edcalderon/versioning` integration for
maintainers.

From `packages/cli`:

```bash
npm run version:status
npm run version:validate
npm run version:update-readme
npm run version:bump:patch
npm run version:bump:prerelease
```

What these do today:

- `version:validate` checks package version state and fails if `README.md` is out of sync with `CHANGELOG.md`
- `version:update-readme` regenerates the `Latest Changes` block from `CHANGELOG.md`
- `version:bump:*` updates the package version without creating a commit or tag
- `scripts/release.sh` wraps this flow and keeps the public tag format as `cli-vx.y.z`

## Local Files and State

The CLI resolves paths through XDG config conventions.

Default locations:

- `~/.config/cig/credentials.json`
- `~/.config/cig/secrets.json`
- `~/.config/cig/profiles.json`
- `~/.config/cig/state.json`
- `~/.cig/install`

Storage meaning:

- `credentials.json` contains encrypted AWS/GCP reference values
- `secrets.json` contains encrypted auth tokens, bootstrap token, and node identity
- `profiles.json` contains API/control-plane connection profiles
- `state.json` contains local install metadata and service status summary
- `~/.cig/install` contains generated compose assets and staged runtime bundle files

## Command Reference

### `cig login`

```bash
cig login --api-url http://localhost:8000
```

Current behavior:

- starts device authorization
- prints verification URL and user code
- polls until approved, denied, expired, or slowed down
- stores access and refresh tokens locally
- saves a default managed-cloud profile

### `cig logout`

```bash
cig logout --api-url http://localhost:8000
```

Current behavior:

- attempts API logout
- clears stored local credentials and secrets

### `cig doctor`

```bash
cig doctor
```

Current behavior:

- checks Docker Engine
- checks Docker Compose availability
- checks free memory
- checks free disk
- checks port availability

This is currently most useful for self-hosted mode.

### `cig install`

```bash
cig install --mode managed --profile core --api-url http://localhost:8000
cig install --mode self-hosted --profile core
```

Managed mode today:

- requires working API auth and enrollment endpoints
- stages `node-runtime/config.json`
- stages `node-runtime/identity.json`
- stages `node-runtime/cig-node.service`
- writes install state locally

Self-hosted mode today:

- generates bootstrap token
- writes compose files into the install directory
- starts the compose stack locally
- waits for health endpoints
- stores local install state

### `cig enroll`

```bash
cig enroll --api-url http://localhost:8000 --profile core
```

Current behavior:

- requests an enrollment token if one is not provided
- generates an Ed25519 key pair locally
- enrolls against the target API using the public key
- stores returned target identity locally

### `cig bootstrap-reset`

```bash
cig bootstrap-reset
```

Current behavior:

- generates a new bootstrap token
- stores it in the encrypted secrets store
- prints the token for operator use

### `cig connect`

```bash
cig connect aws --role-arn arn:aws:iam::123456789012:role/CIGDiscovery
cig connect gcp --service-account ./service-account.json
cig connect api --url https://app.cig.lat --auth-mode managed
```

Current behavior:

- stores AWS and GCP references without validating remote permissions
- stores API/control-plane profiles for managed, self-hosted, or direct API use

### `cig permissions`

```bash
cig permissions
```

Current behavior:

- prints the tier model only
- does not yet request, grant, revoke, or persist permissions

### `cig status`

```bash
cig status
cig status --json
```

Current behavior:

- reads local install state
- reads the default connection profile
- prints a local summary or JSON payload

### `cig open`

```bash
cig open
```

Current behavior:

- prints the best available dashboard URL
- does not open a browser window

### `cig upgrade`

```bash
cig upgrade
```

Current behavior:

- marks the installation as stopped
- prepares for a later bundle rollout
- does not yet perform automated upgrade or rollback

### `cig uninstall`

```bash
cig uninstall
cig uninstall --purge-data
```

Current behavior:

- reads local state
- attempts `docker compose down` for self-hosted installs
- deletes local install state
- optionally removes the install directory

## Recommended Operator Flows

### Managed control plane

1. `cig login --api-url <api>`
2. `cig install --mode managed --profile core --api-url <api>`
3. Copy the staged runtime bundle from `~/.cig/install/node-runtime`
4. Materialize it on a Linux host manually until the privileged installer lands

### Self-hosted local

1. `cig doctor`
2. `cig install --mode self-hosted --profile core`
3. `cig open`
4. Complete the bootstrap flow in the dashboard

## Known Gaps

- no OS keyring backend yet
- no remote executor wiring yet
- no full host installer yet
- no real permission workflow yet
- no connector lifecycle yet
- no browser-launch behavior for `open`
- some older command output still assumes local-host defaults
