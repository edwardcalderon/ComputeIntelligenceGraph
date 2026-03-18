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
fix: set cig.lat as primary domain and keep legacy fallback
```

*Commit message example*

```text
style: bake 90° CW rotation into CIG icon, regenerate all PNGs + favicon
```

*Commit message example*

```text
style(landing): rotate CIG SVG icon 90° clockwise
```

*Commit message example*

```text
feat(landing): loop hero icon+title animation infinitely
```

*Commit message example*

```text
feat(landing): animated hero icon+title sequence (Compute→Intelligence→Graph→CIG)
```

## Architecture

### Project Structure: Turborepo

This project uses **hybrid** module organization.

### Configuration Files

- `.github/workflows/deploy-landing.yml`
- `.github/workflows/publish.yml`
- `.github/workflows/test.yml`
- `apps/dashboard/.next/package.json`
- `apps/dashboard/.next/types/package.json`
- `apps/dashboard/next.config.js`
- `apps/dashboard/package.json`
- `apps/dashboard/playwright.config.ts`
- `apps/dashboard/tailwind.config.ts`
- `apps/dashboard/tsconfig.json`
- `apps/landing/next.config.js`
- `apps/landing/package.json`
- `apps/landing/tailwind.config.ts`
- `apps/landing/tsconfig.json`
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

**Frequency**: ~21 times per month

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

### Landing Page Visual Upgrade

Incrementally enhance the landing page with new visual features, animations, or assets.

**Frequency**: ~3 times per month

**Steps**:
1. Edit or add new React component(s) in apps/landing/app/page.tsx or apps/landing/components/
2. Add or update static assets in apps/landing/public/ (SVGs, PNGs, favicon, manifest, etc.)
3. Optionally update layout in apps/landing/app/layout.tsx
4. Commit changes with a descriptive message

**Files typically involved**:
- `apps/landing/app/page.tsx`
- `apps/landing/app/layout.tsx`
- `apps/landing/components/*.tsx`
- `apps/landing/public/*`

**Example commit sequence**:
```
Edit or add new React component(s) in apps/landing/app/page.tsx or apps/landing/components/
Add or update static assets in apps/landing/public/ (SVGs, PNGs, favicon, manifest, etc.)
Optionally update layout in apps/landing/app/layout.tsx
Commit changes with a descriptive message
```

### Add Or Update Github Actions Workflow

Add or update a GitHub Actions workflow for CI/CD or deployment.

**Frequency**: ~2 times per month

**Steps**:
1. Create or modify .github/workflows/*.yml
2. Optionally update related configuration files (e.g., apps/landing/next.config.js)
3. Commit with a message referencing the workflow or deployment

**Files typically involved**:
- `.github/workflows/*.yml`
- `apps/landing/next.config.js`

**Example commit sequence**:
```
Create or modify .github/workflows/*.yml
Optionally update related configuration files (e.g., apps/landing/next.config.js)
Commit with a message referencing the workflow or deployment
```

### Monorepo Versioning And Release Management

Upgrade versioning tools, sync package versions, and automate release scripts across the monorepo.

**Frequency**: ~2 times per month

**Steps**:
1. Upgrade or configure versioning tool (e.g., @edcalderon/versioning)
2. Add or update release scripts (scripts/release.sh, package.json scripts)
3. Update root and package-level package.json files
4. Update documentation (README.md, VERSIONING_GUIDE.md, etc.)
5. Sync versions across all packages
6. Commit with a message referencing versioning or release

**Files typically involved**:
- `package.json`
- `packages/*/package.json`
- `scripts/release.sh`
- `README.md`
- `VERSIONING_GUIDE.md`

**Example commit sequence**:
```
Upgrade or configure versioning tool (e.g., @edcalderon/versioning)
Add or update release scripts (scripts/release.sh, package.json scripts)
Update root and package-level package.json files
Update documentation (README.md, VERSIONING_GUIDE.md, etc.)
Sync versions across all packages
Commit with a message referencing versioning or release
```

### Documentation Reorganization Or Expansion

Reorganize, add, or update documentation structure and content.

**Frequency**: ~2 times per month

**Steps**:
1. Edit or add files in docs/ (including subfolders)
2. Update README.md if needed
3. Commit with a message referencing docs or documentation

**Files typically involved**:
- `docs/**/*`
- `README.md`

**Example commit sequence**:
```
Edit or add files in docs/ (including subfolders)
Update README.md if needed
Commit with a message referencing docs or documentation
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
