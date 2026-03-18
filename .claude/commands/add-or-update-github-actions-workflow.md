---
name: add-or-update-github-actions-workflow
description: Workflow command scaffold for add-or-update-github-actions-workflow in ComputeIntelligenceGraph.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-or-update-github-actions-workflow

Use this workflow when working on **add-or-update-github-actions-workflow** in `ComputeIntelligenceGraph`.

## Goal

Add or update a GitHub Actions workflow for CI/CD or deployment.

## Common Files

- `.github/workflows/*.yml`
- `apps/landing/next.config.js`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or modify .github/workflows/*.yml
- Optionally update related configuration files (e.g., apps/landing/next.config.js)
- Commit with a message referencing the workflow or deployment

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.