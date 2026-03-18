---
name: add-or-upgrade-app-feature-with-ui-and-config
description: Workflow command scaffold for add-or-upgrade-app-feature-with-ui-and-config in ComputeIntelligenceGraph.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-or-upgrade-app-feature-with-ui-and-config

Use this workflow when working on **add-or-upgrade-app-feature-with-ui-and-config** in `ComputeIntelligenceGraph`.

## Goal

Adds or upgrades a feature in an app (e.g., landing, dashboard, wizard-ui), involving updates to UI components, app/page/layout files, and related config (Next.js, package.json, tsconfig, etc).

## Common Files

- `apps/landing/app/page.tsx`
- `apps/landing/app/layout.tsx`
- `apps/landing/components/*.tsx`
- `apps/landing/next.config.js`
- `apps/landing/package.json`
- `apps/landing/tsconfig.json`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit or create files in apps/<app>/app/page.tsx and/or layout.tsx
- Add or update supporting UI components in apps/<app>/components/
- Update Next.js config (apps/<app>/next.config.js) if needed
- Update package.json, tsconfig.json, and/or add new dependencies
- Update or add public assets if needed (apps/<app>/public/...)

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.