## [0.1.4](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/cli-v0.1.3...cli-v0.1.4) (2026-03-25)


### Features

- detect Docker when it is installed but the daemon is stopped, then offer to start or initialize it during setup
- add explicit remediation flows for Docker daemon start, package installation, and manual prereq issues
- keep the CLI installer wizard responsible for host remediation instead of failing early on Docker startup state

### Release

- bump `@cig-technology/cli` to `0.1.4` for the Docker daemon auto-init flow
- keep package-local release tags on the `cli-v*` line independent from the monorepo root semver line


## [0.1.3](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/cli-v0.1.2...cli-v0.1.3) (2026-03-25)


### Features

- add a public `curl -fsSL https://cig.lat/install.sh | bash` install path to the CLI README
- make the public installer resolve `@cig-technology/cli` from the npm registry first
- add registry, dashboard, and install-guide links to the package README

### Release

- keep the web installer aligned with the published npm package so remote installs use the same binaries and provenance
- keep the package-local `cli-v*` release line independent from the monorepo root semver line
- keep `bash ./install.sh` as the local checkout fallback for contributors



## [0.1.2](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/cli-v0.1.1...cli-v0.1.2) (2026-03-25)


### Features

- add `cig setup` as the first-class onboarding wizard for self-hosted and managed installs
- add a root `install.sh` wrapper that validates prerequisites and launches the wizard
- seed the initial graph during install and persist it until login can upload it
- preserve the existing `login`, `enroll`, `connect`, `status`, `open`, `upgrade`, and `uninstall` commands

### Release

- package-local release line starts at `0.1.2` and is tagged as `cli-v0.1.2`
- changelog links now compare against `cli-v*` tags instead of the monorepo root `v*` tags
- this package release is independent from the monorepo root semver line





# Changelog

All notable changes to `@cig-technology/cli` are documented in this file.

## [0.1.1] - 2026-03-21

### Changed
- add package-local `@edcalderon/versioning` integration for validation, version sync, README sync, and prerelease workflows
- add package-local README guard and changelog-driven README update scripts
- expand CLI documentation and release guidance for operators and maintainers

## [0.1.0] - 2026-03-21

### Added
- first public foundation release of `@cig-technology/cli`
- standalone npm packaging and `cli-v*.*.*` GitHub Actions publish workflow
- managed enrollment flow with client-generated Ed25519 node keys
- self-hosted compose generation and local install state tracking
- staged `cig-node` runtime bundle generation
