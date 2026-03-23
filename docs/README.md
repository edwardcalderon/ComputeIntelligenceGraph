# Documentation Index

This directory contains the current project documentation linked from the root README and the supporting references that go with it.

Last synchronized with the root documentation links on `2026-03-23` for `v0.1.51`.

## Canonical Entry Points

- [../README.md](../README.md) — root project overview and multilingual entry page
- [../PROJECT_STATUS.md](../PROJECT_STATUS.md) — current release-aware status snapshot
- [architecture/README.md](architecture/README.md) — current system shape, runtime roles, and implementation boundaries
- [development/README.md](development/README.md) — local workflow, validation, and release commands
- [deployment/README.md](deployment/README.md) — domains, deployment surfaces, and build verification entry points
- [authentication/README.md](authentication/README.md) — Authentik/Supabase auth flows, provisioning, and logout behavior

## Supporting Docs

- [reference/README.md](reference/README.md) — root-level references and generated summaries
- [reference/cli.md](reference/cli.md) — current CLI usage and command behavior
- [architecture/cli-current-state.md](architecture/cli-current-state.md) — CLI and node-runtime implementation notes
- [testing/README.md](testing/README.md) — testing entry points, performance notes, and security notes
- [development/cross-platform.md](development/cross-platform.md)
- [testing/performance.md](testing/performance.md)
- [testing/security.md](testing/security.md)

## Historical Material

- [archive/README.md](archive/README.md)

## Sync Rules

- Keep the shared-link set in [../README.md](../README.md) and this index aligned
- When the root version, primary domains, or app/package roles change, update these files together:
  - [../PROJECT_STATUS.md](../PROJECT_STATUS.md)
  - [architecture/README.md](architecture/README.md)
  - [development/README.md](development/README.md)
  - [deployment/README.md](deployment/README.md)
  - [authentication/README.md](authentication/README.md)
- Keep current implementation docs outside `archive/`
- Move superseded proposals and historical planning material into `archive/`
- Treat the codebase as the final source of truth when documentation and implementation diverge
