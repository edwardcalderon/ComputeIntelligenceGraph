# Development Notes

## Recommended Local Workflow

Install dependencies:

```bash
pnpm install
```

Start local dependencies:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

Start the pieces you are working on:

```bash
pnpm dev:dashboard
pnpm dev:api
```

If you need the whole workspace, use:

```bash
pnpm dev:all
```

## Validation

```bash
pnpm test
pnpm lint
pnpm version:validate
```

## Related Docs

- Cross-platform notes: [cross-platform.md](cross-platform.md)
- Root workspace scripts and versioning: [../../VERSIONING_GUIDE.md](../../VERSIONING_GUIDE.md)