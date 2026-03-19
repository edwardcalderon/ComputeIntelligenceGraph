# Feature Request: Workspace Env Management Extension for `@edcalderon/versioning`

## Summary

Add a first-class extension for workspace env management so monorepos can define one canonical env manifest and generate per-target env files from it.

## Problem

In multi-app monorepos, env handling is usually fragmented:

- Frontend frameworks expect app-local `.env*` files.
- Backend packages often read ambient `process.env`.
- Teams duplicate the same variables across several package folders.
- Example env files drift away from the real runtime contract.
- Build caches do not always invalidate when the root env source changes.

This creates repeated manual setup and inconsistent conventions across repositories.

## Concrete Use Case

In Compute Intelligence Graph, we implemented a repo-local pattern with:

- A canonical env manifest in `config/env/manifest.cjs`
- A sync command that reads root `.env` / `.env.local`
- Generated per-target `.env.local` files for apps and runtime packages
- Generated tracked example files such as `.env.example` and target-specific `.env.example`
- Root scripts and release flow wired to run env sync automatically

The pattern works, but it would be more reusable if `@edcalderon/versioning` could provide it as an extension.

## Proposed Extension Responsibilities

### 1. Canonical Manifest

Allow a workspace file such as `config/env/manifest.{js,ts,json}` with:

- canonical variable names
- aliases
- descriptions
- secret/public metadata
- example values
- target definitions
- source-to-target key mapping

### 2. Sync Command

Provide a command such as:

```bash
versioning env sync
```

That can:

- read root env sources
- generate per-target `.env.local` files
- generate root and target example files
- support target filtering
- avoid touching unchanged files

### 3. Doctor / Validation Command

Provide a command such as:

```bash
versioning env doctor
versioning env validate --target landing
```

That can:

- report missing required variables by target
- report unknown or unused root keys
- optionally fail CI for selected targets

### 4. Workspace Script Integration

Because `@edcalderon/versioning` already manages workspace automation, the extension could optionally add:

- `env:sync`
- `env:doctor`
- hook integration before `dev`, `build`, or `release`

## Scope Boundary

This should be an extension, not part of core version bump logic. Env orchestration is a strong fit for the extension model because:

- not every repo needs it
- the config surface is larger than basic versioning
- teams may want to opt in gradually

## Expected Benefits

- one repo-standard env workflow across multiple projects
- less duplicated `.env` maintenance
- safer mapping of canonical vars to frontend-public vars
- generated examples that stay aligned with code
- easier onboarding for monorepos with several apps and services

## Nice-to-Have Options

- `.env.production` / `.env.staging` modes
- secret masking in logs
- target inheritance
- generated docs from env manifest metadata
- cache integration hints for Turborepo / Nx

## Reference Implementation

The initial working pattern exists in the Compute Intelligence Graph repo and can be used as a seed for the extension design.
