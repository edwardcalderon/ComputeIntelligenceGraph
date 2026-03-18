---
name: add-or-update-app-feature
description: Workflow command scaffold for add-or-update-app-feature in ComputeIntelligenceGraph.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-or-update-app-feature

Use this workflow when working on **add-or-update-app-feature** in `ComputeIntelligenceGraph`.

## Goal

Implements or updates a feature in an app (e.g., landing, dashboard, wizard-ui), often involving UI components, configuration, and sometimes assets.

## Common Files

- `apps/{app}/app/page.tsx`
- `apps/{app}/app/layout.tsx`
- `apps/{app}/components/*.tsx`
- `apps/{app}/public/*`
- `apps/{app}/next.config.js`
- `apps/{app}/package.json`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit or create files in apps/{app}/app/ (e.g., page.tsx, layout.tsx)
- Optionally add or update files in apps/{app}/components/
- Optionally update apps/{app}/public/ assets (e.g., icons, favicons, manifest PNGs)
- Optionally update apps/{app}/next.config.js or package.json if config or dependencies change

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.