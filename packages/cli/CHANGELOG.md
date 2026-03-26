## [0.1.10](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/cli-v0.1.9...cli-v0.1.10) (2026-03-26)


### Bug Fixes

* **cli:** keep interactive installer attached to tty ([303916e](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/303916edbd53e9901a43e347dde954e8a78edb1b))
* **cli:** keep setup cancel flow open ([fc4dfe5](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/fc4dfe5c6b17e29bb91b205b4c74acd530773b2d))





## [0.1.9](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/cli-v0.1.8...cli-v0.1.9) (2026-03-25)


### Bug Fixes

* **cli:** keep setup wizard open until dismiss ([991fc9e](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/991fc9ebcebed2c7514597dc955450682acd2423))





## [0.1.8](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/cli-v0.1.7...cli-v0.1.8) (2026-03-25)

### Features

- migrate the CLI runtime to Oclif command classes with a central dispatcher
- switch the onboarding wizard to Clack for a more polished terminal experience
- run the CLI package as native ESM so the new prompt stack works cleanly on Node 22
- display the actual CLI package version in the setup/install banner
- derive the version banner from `packages/cli/package.json` instead of a stale constant
- harden the public `curl | bash` installer so it resolves the published npm binary first
- detect Docker daemon availability and guide users through install/start remediation
- keep the setup wizard interactive when prerequisite checks fail

### Release

- keep the package-local CLI release line independent from the monorepo root semver line
- preserve the existing command surface while removing the legacy Commander/Inquirer stack
- keep the public installer, README, and changelog synchronized with the published npm package
- reset the package-local CLI release sequence to `0.1.8` so the version line matches the package-local history

## [0.1.122](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/cli-v0.1.7...cli-v0.1.122) (2026-03-25)


### Features

- migrate the CLI command layer to Oclif command classes and a central dispatcher
- replace the onboarding wizard prompts with Clack for a more polished terminal experience
- keep install, login, enrollment, and scan flows working under the new ESM package runtime
- preserve the existing command surface while removing the legacy Commander/Inquirer stack

### Release

- switch the `@cig-technology/cli` package to native ESM so Oclif and Clack can run without CommonJS shims
- keep the package-local CLI version aligned with the current published `0.1.122` line

## [0.1.7](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/cli-v0.1.6...cli-v0.1.7) (2026-03-25)


### Bug Fixes

* **cli:** keep setup wizard interactive ([78e9f74](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/78e9f746a3d9911ac1b31e3a0c6ac16daa5b548e))
* **cli:** resolve public installer versioning ([de7be3c](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/de7be3cf6d6b72967bef772c708ca50eb5c87e2b))





## [0.1.6](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/cli-v0.1.5...cli-v0.1.6) (2026-03-25)


### Features

- display the actual CLI package version in the setup/install banner
- derive the CLI version from the package manifest instead of a stale hardcoded constant
- harden the public bash installer so `curl | bash` does not trip over `BASH_SOURCE` when no script file is present

### Release

- ensure the installation banner reflects the published `@cig-technology/cli` version
- keep the public installer safe in both file-based and piped execution modes


## [0.1.5](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/cli-v0.1.4...cli-v0.1.5) (2026-03-25)





## [0.1.5](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/cli-v0.1.4...cli-v0.1.5) (2026-03-25)


### Features

- distinguish Docker daemon startup failures from admin-access failures during prerequisite checks
- detect Docker with `docker info` so the installer can tell when the daemon is stopped versus when this user lacks access
- refuse Linux auto-remediation when the shell cannot use sudo, and explain that an administrator shell is required

### Release

- keep Docker auto-start and auto-install flows safe when the terminal does not have sudo-capable access
- surface a clearer admin-shell requirement instead of trying commands that cannot succeed


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
