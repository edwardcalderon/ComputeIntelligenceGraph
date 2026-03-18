---
name: computeintelligencegraph-conventions
description: Development conventions and patterns for ComputeIntelligenceGraph. TypeScript project with conventional commits.
---

# Computeintelligencegraph Conventions

> Generated from [edwardcalderon/ComputeIntelligenceGraph](https://github.com/edwardcalderon/ComputeIntelligenceGraph) on 2026-03-18

## Overview

This skill teaches Claude the development patterns and conventions used in ComputeIntelligenceGraph.

## Tech Stack

- **Primary Language**: TypeScript
- **Architecture**: hybrid module organization
- **Test Location**: mixed
- **Test Framework**: playwright

## When to Use This Skill

Activate this skill when:
- Making changes to this repository
- Adding new features following established patterns
- Writing tests that match project conventions
- Creating commits with proper message format

## Commit Conventions

Follow these commit message conventions based on 8 analyzed commits.

### Commit Style: Conventional Commits

### Prefixes Used

- `feat`
- `fix`
- `chore`
- `style`
- `docs`

### Message Guidelines

- Average message length: ~66 characters
- Keep first line concise and descriptive
- Use imperative mood ("Add feature" not "Added feature")


*Commit message example*

```text
fix: resolve lint failures across all workspace packages
```

*Commit message example*

```text
feat(auth): add @cig/auth package with Supabase OAuth + multi-method sign-in modal
```

*Commit message example*

```text
chore: add MIT license metadata
```

*Commit message example*

```text
docs: reorganize documentation structure
```

*Commit message example*

```text
style: bake 90° CW rotation into CIG icon, regenerate all PNGs + favicon
```

*Commit message example*

```text
fix: set cig.lat as primary domain and keep legacy fallback
```

*Commit message example*

```text
style(landing): rotate CIG SVG icon 90° clockwise
```

*Commit message example*

```text
feat(landing): loop hero icon+title animation infinitely
```

## Architecture

### Project Structure: Turborepo

This project uses **hybrid** module organization.

### Configuration Files

- `.github/workflows/deploy-landing.yml`
- `.github/workflows/publish.yml`
- `.github/workflows/test.yml`
- `apps/dashboard/.eslintrc.json`
- `apps/dashboard/.next/package.json`
- `apps/dashboard/.next/types/package.json`
- `apps/dashboard/next.config.js`
- `apps/dashboard/package.json`
- `apps/dashboard/playwright.config.ts`
- `apps/dashboard/tailwind.config.ts`
- `apps/dashboard/tsconfig.json`
- `apps/landing/.eslintrc.json`
- `apps/landing/next.config.js`
- `apps/landing/package.json`
- `apps/landing/tailwind.config.ts`
- `apps/landing/tsconfig.json`
- `apps/wizard-ui/.eslintrc.json`
- `apps/wizard-ui/next.config.js`
- `apps/wizard-ui/package.json`
- `apps/wizard-ui/tsconfig.json`
- `docker-compose.yml`
- `package.json`
- `packages/agents/package.json`
- `packages/agents/tsconfig.json`
- `packages/api/package.json`
- `packages/api/tsconfig.json`
- `packages/auth/package.json`
- `packages/auth/tsconfig.json`
- `packages/chatbot/node_modules/.ignored/fast-check/lib/esm/package.json`
- `packages/chatbot/node_modules/.ignored/fast-check/package.json`
- `packages/chatbot/node_modules/pure-rand/lib/esm/package.json`
- `packages/chatbot/node_modules/pure-rand/package.json`
- `packages/chatbot/package.json`
- `packages/chatbot/tsconfig.json`
- `packages/cli/node_modules/.ignored/fast-check/lib/esm/package.json`
- `packages/cli/node_modules/.ignored/fast-check/package.json`
- `packages/cli/node_modules/pure-rand/lib/esm/package.json`
- `packages/cli/node_modules/pure-rand/package.json`
- `packages/cli/package.json`
- `packages/cli/tsconfig.json`
- `packages/config/node_modules/.ignored/fast-check/lib/esm/package.json`
- `packages/config/node_modules/.ignored/fast-check/package.json`
- `packages/config/node_modules/pure-rand/lib/esm/package.json`
- `packages/config/node_modules/pure-rand/package.json`
- `packages/config/package.json`
- `packages/config/tsconfig.json`
- `packages/discovery/package.json`
- `packages/discovery/tsconfig.json`
- `packages/graph/package.json`
- `packages/graph/tsconfig.json`
- `packages/iac/package.json`
- `packages/sdk/package.json`
- `packages/sdk/tsconfig.json`
- `services/cartography/Dockerfile`

### Guidelines

- This project uses a hybrid organization
- Follow existing patterns when adding new code

## Code Style

### Language: TypeScript

### Naming Conventions

| Element | Convention |
|---------|------------|
| Files | PascalCase |
| Functions | camelCase |
| Classes | PascalCase |
| Constants | SCREAMING_SNAKE_CASE |

### Import Style: Relative Imports

### Export Style: Mixed Style


*Preferred import style*

```typescript
// Use relative imports
import { Button } from '../components/Button'
import { useAuth } from './hooks/useAuth'
```

## Testing

### Test Framework: playwright

### File Pattern: `*.test.ts`

### Test Types

- **Unit tests**: Test individual functions and components in isolation
- **Integration tests**: Test interactions between multiple components/services
- **E2e tests**: Test complete user flows through the application

### Mocking: vi.mock


## Error Handling

### Error Handling Style: Try-Catch Blocks


*Standard error handling pattern*

```typescript
try {
  const result = await riskyOperation()
  return result
} catch (error) {
  console.error('Operation failed:', error)
  throw new Error('User-friendly message')
}
```

## Common Workflows

These workflows were detected from analyzing commit patterns.

### Feature Development

Standard feature implementation workflow

**Frequency**: ~22 times per month

**Steps**:
1. Add feature implementation
2. Add tests for feature
3. Update documentation

**Files typically involved**:
- `apps/dashboard/.next/types/app/graph/*`
- `apps/dashboard/.next/types/app/*`
- `apps/dashboard/.next/types/app/resources/*`
- `**/*.test.*`
- `**/api/**`

**Example commit sequence**:
```
feat: upgrade to @edcalderon/versioning v1.4.7 with workspace-scripts
chore: configure GitHub Pages deployment for landing page
fix: update pnpm version to 9 in deploy-landing workflow
```

### Add Or Upgrade App Feature With Ui And Config

Adds or upgrades a feature in an app (e.g., landing, dashboard, wizard-ui), involving updates to UI components, app/page/layout files, and related config (Next.js, package.json, tsconfig, etc).

**Frequency**: ~3 times per month

**Steps**:
1. Edit or create files in apps/<app>/app/page.tsx and/or layout.tsx
2. Add or update supporting UI components in apps/<app>/components/
3. Update Next.js config (apps/<app>/next.config.js) if needed
4. Update package.json, tsconfig.json, and/or add new dependencies
5. Update or add public assets if needed (apps/<app>/public/...)

**Files typically involved**:
- `apps/landing/app/page.tsx`
- `apps/landing/app/layout.tsx`
- `apps/landing/components/*.tsx`
- `apps/landing/next.config.js`
- `apps/landing/package.json`
- `apps/landing/tsconfig.json`
- `apps/landing/public/*`
- `apps/dashboard/app/page.tsx`
- `apps/dashboard/app/layout.tsx`
- `apps/dashboard/components/*.tsx`
- `apps/dashboard/next.config.js`
- `apps/dashboard/package.json`
- `apps/dashboard/tsconfig.json`
- `apps/wizard-ui/app/page.tsx`
- `apps/wizard-ui/app/layout.tsx`
- `apps/wizard-ui/next.config.js`
- `apps/wizard-ui/package.json`
- `apps/wizard-ui/tsconfig.json`

**Example commit sequence**:
```
Edit or create files in apps/<app>/app/page.tsx and/or layout.tsx
Add or update supporting UI components in apps/<app>/components/
Update Next.js config (apps/<app>/next.config.js) if needed
Update package.json, tsconfig.json, and/or add new dependencies
Update or add public assets if needed (apps/<app>/public/...)
```

### Add Or Update Monorepo Package

Creates a new package or updates an existing one in the monorepo, including source, config, and registration in the workspace.

**Frequency**: ~2 times per month

**Steps**:
1. Create or update packages/<pkg>/src/*.ts files
2. Update or create packages/<pkg>/package.json
3. Update or create packages/<pkg>/tsconfig.json
4. Add or update index.ts and other entry points
5. Update pnpm-lock.yaml to register new dependencies
6. If new, add to workspace scripts/config

**Files typically involved**:
- `packages/*/src/*.ts`
- `packages/*/package.json`
- `packages/*/tsconfig.json`
- `packages/*/index.ts`
- `pnpm-lock.yaml`

**Example commit sequence**:
```
Create or update packages/<pkg>/src/*.ts files
Update or create packages/<pkg>/package.json
Update or create packages/<pkg>/tsconfig.json
Add or update index.ts and other entry points
Update pnpm-lock.yaml to register new dependencies
If new, add to workspace scripts/config
```

### Add Or Update Linting And Typescript Config

Adds or updates linting (eslint) and TypeScript configuration for apps or packages, ensuring code quality and type safety.

**Frequency**: ~2 times per month

**Steps**:
1. Add or update .eslintrc.json in app/package directory
2. Update package.json to add or modify lint scripts and devDependencies
3. Update tsconfig.json to include/exclude files as needed
4. Update pnpm-lock.yaml if dependencies change

**Files typically involved**:
- `apps/*/.eslintrc.json`
- `apps/*/package.json`
- `apps/*/tsconfig.json`
- `packages/*/.eslintrc.json`
- `packages/*/package.json`
- `packages/*/tsconfig.json`
- `pnpm-lock.yaml`

**Example commit sequence**:
```
Add or update .eslintrc.json in app/package directory
Update package.json to add or modify lint scripts and devDependencies
Update tsconfig.json to include/exclude files as needed
Update pnpm-lock.yaml if dependencies change
```

### Add Or Update Github Actions Workflow

Adds or updates a GitHub Actions workflow for CI/CD (e.g., deployment, testing, publishing).

**Frequency**: ~2 times per month

**Steps**:
1. Create or update .github/workflows/*.yml
2. Update related app/package config if needed (e.g., next.config.js for static export)
3. Commit with a message referencing the workflow purpose

**Files typically involved**:
- `.github/workflows/*.yml`
- `apps/*/next.config.js`

**Example commit sequence**:
```
Create or update .github/workflows/*.yml
Update related app/package config if needed (e.g., next.config.js for static export)
Commit with a message referencing the workflow purpose
```

### Docs Structure Update

Reorganizes or adds documentation files, including README, architecture, deployment, testing, and archival docs.

**Frequency**: ~2 times per month

**Steps**:
1. Edit or create docs/*.md and docs/*/*.md files
2. Update README.md and other top-level documentation
3. Add or reorganize files in docs/archive/, docs/deployment/, docs/development/, docs/testing/, etc.

**Files typically involved**:
- `README.md`
- `docs/*.md`
- `docs/*/*.md`
- `docs/archive/*.md`

**Example commit sequence**:
```
Edit or create docs/*.md and docs/*/*.md files
Update README.md and other top-level documentation
Add or reorganize files in docs/archive/, docs/deployment/, docs/development/, docs/testing/, etc.
```


## Best Practices

Based on analysis of the codebase, follow these practices:

### Do

- Use conventional commit format (feat:, fix:, etc.)
- Write tests using playwright
- Follow *.test.ts naming pattern
- Use PascalCase for file names
- Prefer mixed exports

### Don't

- Don't write vague commit messages
- Don't skip tests for new features
- Don't deviate from established patterns without discussion

---

*This skill was auto-generated by [ECC Tools](https://ecc.tools). Review and customize as needed for your team.*
