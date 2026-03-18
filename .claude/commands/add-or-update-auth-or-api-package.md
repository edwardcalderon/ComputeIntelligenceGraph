---
name: add-or-update-auth-or-api-package
description: Workflow command scaffold for add-or-update-auth-or-api-package in ComputeIntelligenceGraph.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-or-update-auth-or-api-package

Use this workflow when working on **add-or-update-auth-or-api-package** in `ComputeIntelligenceGraph`.

## Goal

Creates a new package or updates an existing one, including implementation, configuration, and integration into an app.

## Common Files

- `packages/{package}/src/*`
- `packages/{package}/package.json`
- `packages/{package}/tsconfig.json`
- `apps/{app}/app/*`
- `apps/{app}/components/*`
- `apps/{app}/.env.example`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or edit packages/{package}/src/* (implementation files)
- Add or update packages/{package}/package.json and tsconfig.json
- Edit apps/{app}/app/* and/or components to integrate the package
- Update pnpm-lock.yaml to reflect dependency changes
- Optionally update .env.example or config files in the app

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.