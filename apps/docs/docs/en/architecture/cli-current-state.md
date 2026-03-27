---
id: cli-current-state
title: CLI and Node Runtime Current State
description: Implementation snapshot for the CLI and runtime work
sidebar_position: 5
---

# CLI and Node Runtime: Current State

This page is the implementation snapshot for the CLI and runtime work as it exists today.

## What Exists

### CLI package

- Public npm package: `@cig-technology/cli`
- Release tags: `cli-v*.*.*`
- Local release helper under `packages/cli/scripts/release.sh`
- Package-local versioning and README guard workflow
- Command surface for auth, setup, install, enroll, connect, status, open, upgrade, and uninstall
- Root `install.sh` onboarding wrapper for Linux and macOS

### Runtime-oriented groundwork

- `packages/runtime-contracts` defines shared node/profile/permission contracts
- `packages/node-runtime` exists as a Linux-first runtime skeleton
- the CLI can stage a runtime bundle with config, identity, and a rendered `systemd` unit file

### API compatibility work

- enrollment accepts client-generated public keys
- CLI enrollment generates Ed25519 keys locally

## What Works End-to-End Today

- publishable CLI package build/test/pack flow
- local credential and state persistence
- self-hosted compose generation
- self-hosted local stack startup attempt via Docker Compose
- managed login and enrollment request flow
- interactive `cig setup` onboarding flow
- automatic initial graph capture during install, with upload once auth is available

## What Remains Partial

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
- browser wizard implementation in `apps/wizard-ui`
