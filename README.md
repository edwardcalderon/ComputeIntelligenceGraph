# CIG

[![Version](https://img.shields.io/badge/version-0.1.45-blue.svg)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](package.json)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9.0.0-orange.svg)](package.json)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Compute Intelligence Graph is a self-hosted infrastructure intelligence platform for discovery, graph modeling, querying, cost analysis, and security review across cloud environments.

Primary public domain: https://cig.lat/

## Current State

The repository contains a working core platform plus a few scaffolded areas that are not finished yet.

### Implemented

- Dashboard application with resource views, graph visualization, costs, security, and Playwright E2E coverage
- Fastify API with REST, GraphQL, WebSocket, auth, rate limiting, and metrics
- Neo4j graph engine with traversal and circular dependency handling
- Discovery orchestration plus Python Cartography service
- RAG/chatbot pipeline and agent packages for query reasoning and actions
- CLI for install, connect, deploy, seed, reset, and status workflows
- Docker Compose plus separate Docker and Terraform infrastructure assets
- `@cig/infra` package wrapping `@lsts_tech/infra` for AWS deployments (Authentik + dashboard pipelines)

### Still Scaffolded or Partial

- `apps/landing` is present but still minimal
- `apps/wizard-ui` is mostly a bare Next.js scaffold
- `packages/sdk` is scaffolded and not feature-complete

## Repository Layout

```text
apps/
  dashboard/     Main Next.js dashboard UI
  landing/       Public landing site scaffold
  wizard-ui/     Installation wizard scaffold
packages/
  agents/        OpenClaw and OpenFang agent logic
  api/           Fastify REST, GraphQL, and WebSocket API
  auth/          Authentication helpers and session management
  chatbot/       RAG and vector retrieval pipeline
  cli/           CLI commands and credential handling
  config/        YAML config loading and validation
  discovery/     Discovery orchestration and scheduler
  graph/         Neo4j graph engine
  iac/           Terraform modules consumed by the deployment wrapper
  infra/         TypeScript AWS deployment wrapper (@lsts_tech/infra)
  sdk/           SDK scaffold
services/
  cartography/   Python FastAPI discovery service
infra/
  docker/        Container build definitions
docs/            Organized project documentation
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Engine or Docker Desktop
- Docker Compose

### Install

```bash
pnpm install
```

### Sync workspace env files

```bash
pnpm env:sync
pnpm env:doctor
pnpm env:validate
```

The root `.env` is the canonical local input. `@edcalderon/versioning` now generates per-target `.env.local` files and tracked `.env.example` files from the workspace manifest automatically.

### Start local infrastructure

```bash
docker-compose -f docker-compose.dev.yml up -d
```

This starts the local service dependencies used by the platform, including Neo4j and Chroma.

### Start application code

For focused development, start only what you need:

```bash
pnpm dev:dashboard
pnpm dev:api
pnpm dev:landing
```

You can also start the whole workspace:

```bash
pnpm dev:all
```

When multiple Next.js apps run together, they will use the next available local ports.

### Build

```bash
pnpm build
```

Or build a single workspace:

```bash
pnpm build:dashboard
pnpm build:api
```

## Common Scripts

### Development

```bash
pnpm dev:dashboard
pnpm dev:landing
pnpm dev:wizard-ui
pnpm dev:api
pnpm dev:agents
pnpm dev:chatbot
pnpm dev:cli
pnpm dev:discovery
pnpm dev:graph
pnpm dev:sdk
pnpm dev:all
```

### Validation

```bash
pnpm env:doctor
pnpm env:validate
pnpm test
pnpm lint
pnpm version:validate
pnpm version:status
```

### Release

```bash
pnpm release
pnpm release:build
pnpm release:dry:build
pnpm release:dry
pnpm release:patch
pnpm release:minor
pnpm release:major
```

## Testing

- Unit and integration tests run with `pnpm test`
- Dashboard E2E tests run from `apps/dashboard` with `pnpm test:e2e`
- Security testing notes: [docs/testing/security.md](docs/testing/security.md)
- Performance testing notes: [docs/testing/performance.md](docs/testing/performance.md)

## Documentation

- Docs index: [docs/README.md](docs/README.md)
- Authentication notes: [docs/authentication/README.md](docs/authentication/README.md)
- Architecture notes: [docs/architecture/README.md](docs/architecture/README.md)
- Development notes: [docs/development/README.md](docs/development/README.md)
- Deployment notes: [docs/deployment/README.md](docs/deployment/README.md)
- Reference notes: [docs/reference/README.md](docs/reference/README.md)
- Historical material: [docs/archive/README.md](docs/archive/README.md)

Additional root-level project records:

- Current status snapshot: [PROJECT_STATUS.md](PROJECT_STATUS.md)
- Versioning workflow: [VERSIONING_GUIDE.md](VERSIONING_GUIDE.md)
- Versioning upgrade notes: [UPGRADE_SUMMARY.md](UPGRADE_SUMMARY.md)

## Notes

- The root README is intended to describe the current codebase conservatively.
- Historical planning documents have been moved under `docs/archive/` to separate them from active documentation.
- If you are trying to understand implementation status, treat the codebase and the docs index as the source of truth before older blueprint documents.
- Conversational Interface (RAG)
- Infrastructure Actions
- CLI & Installation
- Multi-Cloud Support
- Cost & Security Features

### 🟡 In Progress
- Testing & Hardening (85%)
- Documentation & Release (40%)

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for detailed status.

---

## 🔧 Version Management

This project uses [@edcalderon/versioning](https://www.npmjs.com/package/@edcalderon/versioning) v1.5.1 for:

- ✅ Version synchronization across all packages
- ✅ Auto-generated workspace scripts (dev:all, build:all)
- ✅ Private package leak prevention
- ✅ Cleanup utilities
- ✅ Branch-aware versioning

All packages maintain version **0.1.45** in sync.

---

## 📝 License

TBD - To be determined before v1.0.0 release

---

## 🙏 Acknowledgments

- [Cartography](https://github.com/lyft/cartography) - Infrastructure discovery
- [Neo4j](https://neo4j.com/) - Graph database
- [LangChain](https://www.langchain.com/) - LLM framework
- [@edcalderon/versioning](https://www.npmjs.com/package/@edcalderon/versioning) - Monorepo versioning

---

## 📞 Support

- 📖 Documentation: See `docs/` directory
- 🐛 Issues: GitHub Issues (TBD)
- 💬 Discussions: GitHub Discussions (TBD)

---

**Built with ❤️ for infrastructure engineers**
