---
name: add-or-update-monorepo-package
description: Workflow command scaffold for add-or-update-monorepo-package in ComputeIntelligenceGraph.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-or-update-monorepo-package

Use this workflow when working on **add-or-update-monorepo-package** in `ComputeIntelligenceGraph`.

## Goal

Creates a new package or updates an existing one in the monorepo, including source, config, and registration in the workspace.

## Common Files

- `packages/*/src/*.ts`
- `packages/*/package.json`
- `packages/*/tsconfig.json`
- `packages/*/index.ts`
- `pnpm-lock.yaml`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update packages/<pkg>/src/*.ts files
- Update or create packages/<pkg>/package.json
- Update or create packages/<pkg>/tsconfig.json
- Add or update index.ts and other entry points
- Update pnpm-lock.yaml to register new dependencies

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.