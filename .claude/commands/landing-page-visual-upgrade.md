---
name: landing-page-visual-upgrade
description: Workflow command scaffold for landing-page-visual-upgrade in ComputeIntelligenceGraph.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /landing-page-visual-upgrade

Use this workflow when working on **landing-page-visual-upgrade** in `ComputeIntelligenceGraph`.

## Goal

Incrementally enhance the landing page with new visual features, animations, or assets.

## Common Files

- `apps/landing/app/page.tsx`
- `apps/landing/app/layout.tsx`
- `apps/landing/components/*.tsx`
- `apps/landing/public/*`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit or add new React component(s) in apps/landing/app/page.tsx or apps/landing/components/
- Add or update static assets in apps/landing/public/ (SVGs, PNGs, favicon, manifest, etc.)
- Optionally update layout in apps/landing/app/layout.tsx
- Commit changes with a descriptive message

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.