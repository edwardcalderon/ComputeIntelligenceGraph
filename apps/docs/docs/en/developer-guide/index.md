---
id: index
title: Developer Guide
description: CIG Developer Guide
sidebar_position: 1
---

# Developer Guide

Welcome to the CIG Developer Guide. This document explains our monorepo conventions, workspace tools, and the architectural principles we use to build a scalable infrastructure intelligence platform.

## Working with the Monorepo

CIG utilizes **Turbo** and **pnpm** to manage its workspace. For the best development experience, always use these global commands:

- `pnpm install` - Maintain workspace dependencies.
- `pnpm build` - Build all packages in topological order.
- `pnpm test` - Run full workspace test suites.
- `pnpm lint` - Check across all packages.

## Monorepo Standards

### Package Prefixing
*   **`@cig/*`**: All internal core packages.
*   **`@cig-technology/cli`**: Our public CLI tool.

### Type-Safe Development
CIG is 100% TypeScript. We enforce strict type checking and utilize **Zod** for runtime schema validation.

### Versioning & Environment
We use a custom `@edcalderon/versioning` toolset to manage the complex environment and versioning requirements of the monorepo:
*   `pnpm env:sync` - Essential for keeping developers in sync.
*   `pnpm version:status` - Check the release status of packages.
*   `pnpm version:bump:patch` - Automated versioning.

## Development Workflow

1.  **Sync Environment**: Always run `pnpm env:sync` after pulling the latest changes.
2.  **Topological Builds**: Run `pnpm build` at least once to ensure internal package dependencies (like `@cig/sdk` or `@cig/auth`) are compiled for consumers.
3.  **Local Dev Servers**: Use the specialized `dev:*` scripts in the root `package.json` to launch your target applications.
4.  **Conventional Commits**: We strictly follow the Conventional Commits specification for all pull requests.

## Key Resources

- [System Architecture](../architecture/index.md) - Deep dive into how CIG works.
- [Component Breakdown](../architecture/components.md) - Specific details on each package.
- [Contributing Guidelines](./contributing.md) - How to submit PRs.
- [Project Roadmap](../next-steps.md) - What we are building next.
