# Development Notes

Last synchronized with the root README and workspace scripts on `2026-03-23`.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Engine or Docker Desktop
- Docker Compose

## Recommended Local Workflow

Install dependencies:

```bash
pnpm install
```

Sync workspace environment files:

```bash
pnpm env:sync
pnpm env:doctor
pnpm env:validate
```

Start local infrastructure:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

Start the pieces you are working on:

```bash
pnpm dev:landing
pnpm dev:dashboard
pnpm dev:wizard-ui
pnpm dev:api
pnpm dev:agents
pnpm dev:chatbot
pnpm dev:cli
pnpm dev:discovery
pnpm dev:graph
```

If you need the whole workspace:

```bash
pnpm dev:all
```

## Validation

```bash
pnpm test
pnpm lint
pnpm version:validate
pnpm version:status
```

## Release Workflow

The repository release flow is driven by `scripts/release.sh` and exposed through:

```bash
pnpm release:patch
pnpm release:minor
pnpm release:major
pnpm release:dry
```

The standard patch/minor/major release workflow updates package versions, changelog metadata, README version references, and release metadata after running the repository test/build gates.

## Related Docs

- Root overview: [../../README.md](../../README.md)
- Status snapshot: [../../PROJECT_STATUS.md](../../PROJECT_STATUS.md)
- Deployment notes: [../deployment/README.md](../deployment/README.md)
- Cross-platform notes: [cross-platform.md](cross-platform.md)
- Root workspace scripts and versioning: [../../VERSIONING_GUIDE.md](../../VERSIONING_GUIDE.md)
