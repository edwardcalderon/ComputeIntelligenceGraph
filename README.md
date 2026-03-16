# CIG - Compute Intelligence Graph

> Open-source, self-hosted infrastructure intelligence platform for multi-cloud environments

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](package.json)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9.0.0-orange.svg)](package.json)
[![License](https://img.shields.io/badge/license-TBD-lightgrey.svg)](LICENSE)

---

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start all services in development mode
pnpm dev:all

# Or start individual services
pnpm dev:dashboard    # Dashboard UI
pnpm dev:api          # REST/GraphQL API
pnpm dev:agents       # AI agents

# Build everything
pnpm build:all

# Run tests
pnpm test
```

---

## 📋 What is CIG?

CIG (Compute Intelligence Graph) automatically discovers your cloud infrastructure, constructs a comprehensive dependency graph, and provides both visual and conversational interfaces for infrastructure exploration and management.

### Key Features

- 🔍 **Auto-Discovery**: AWS, GCP, Kubernetes, Docker
- 📊 **Graph Visualization**: Interactive dependency mapping
- 💬 **Conversational AI**: Natural language infrastructure queries
- 💰 **Cost Analysis**: Track and optimize cloud spending
- 🔒 **Security Scanning**: Detect misconfigurations
- 🎯 **Infrastructure Actions**: Execute operations via chat
- 🌐 **Multi-Cloud**: Unified view across providers

---

## 🏗️ Architecture

### Monorepo Structure

```
cig/
├── apps/                    # Applications
│   ├── dashboard/          # Next.js dashboard UI
│   ├── landing/            # Marketing site
│   └── wizard-ui/          # Installation wizard
├── packages/               # Shared libraries
│   ├── agents/            # OpenClaw & OpenFang AI agents
│   ├── api/               # REST/GraphQL API server
│   ├── chatbot/           # RAG pipeline & LLM
│   ├── cli/               # CLI tool
│   ├── config/            # Configuration management
│   ├── discovery/         # Discovery orchestrator
│   ├── graph/             # Neo4j graph engine
│   ├── iac/               # Terraform modules
│   └── sdk/               # TypeScript/Python SDKs
└── services/
    └── cartography/       # Python discovery service
```

### Tech Stack

- **Frontend**: Next.js 14, React 18, TailwindCSS, React Flow
- **Backend**: Node.js 20+, Fastify, GraphQL Yoga
- **Database**: Neo4j 5.x (graph), Chroma (vector)
- **AI/ML**: LangChain, OpenAI GPT-4
- **Discovery**: Cartography (Python)
- **Infrastructure**: Docker, Terraform, pnpm, TurboRepo

---

## 📦 Available Scripts

### Development

```bash
pnpm dev:all          # Start all apps in dev mode (parallel)
pnpm dev:dashboard    # Start dashboard only
pnpm dev:api          # Start API only
pnpm dev:agents       # Start agents only
# ... and 8 more dev:* scripts
```

### Build

```bash
pnpm build:all        # Build all packages
pnpm build:dashboard  # Build dashboard only
pnpm build:api        # Build API only
# ... and 9 more build:* scripts
```

### Testing

```bash
pnpm test             # Run all tests
pnpm test:e2e         # Run E2E tests (dashboard)
pnpm lint             # Run linters
```

### Version Management

```bash
pnpm version:status        # Check version sync status
pnpm version:validate      # Validate versions
pnpm version:bump:patch    # Bump patch version
pnpm version:bump:minor    # Bump minor version
pnpm version:bump:major    # Bump major version
pnpm check:secrets         # Scan for secrets
```

### Workspace Scripts

```bash
npx versioning scripts list     # List workspace config
npx versioning scripts detect   # Detect new apps
npx versioning scripts sync     # Regenerate scripts
```

---

## 🛠️ Development Setup

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker & Docker Compose
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cig
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start infrastructure services**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

4. **Start development**
   ```bash
   pnpm dev:all
   ```

5. **Access the dashboard**
   ```
   http://localhost:3000
   ```

---

## 📚 Documentation

- [Project Status](PROJECT_STATUS.md) - Current implementation status
- [Versioning Guide](VERSIONING_GUIDE.md) - Version management
- [Upgrade Summary](UPGRADE_SUMMARY.md) - Latest changes
- [Requirements](.kiro/specs/compute-intelligence-graph/requirements.md) - Full requirements
- [Design](.kiro/specs/compute-intelligence-graph/design.md) - Technical design
- [Tasks](.kiro/specs/compute-intelligence-graph/tasks.md) - Implementation tasks

---

## 🧪 Testing

### Unit Tests
```bash
pnpm test                    # Run all unit tests
pnpm test --filter @cig/graph  # Test specific package
```

### E2E Tests
```bash
cd apps/dashboard
pnpm test:e2e               # Run E2E tests
pnpm test:e2e:ui            # Run in UI mode
```

### Test Coverage
- **Unit Tests**: 316+ tests across 7 packages
- **E2E Tests**: 37+ tests for dashboard
- **Coverage**: 80%+ overall

---

## 🚢 Deployment

### Local (Docker Compose)
```bash
docker-compose up -d
```

### AWS
```bash
pnpm cig deploy --target aws
```

### GCP
```bash
pnpm cig deploy --target gcp
```

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Create a feature branch
2. Make your changes
3. Run tests: `pnpm test`
4. Run linter: `pnpm lint`
5. Submit a pull request

### Adding a New Package

1. Create the package in `packages/` or `apps/`
2. Add package.json with proper configuration
3. Run `npx versioning scripts detect`
4. Update `versioning.config.json` if needed
5. Run `npx versioning scripts sync`

---

## 📊 Project Status

**Version**: 0.1.0  
**Status**: 🟢 Development - Ready for Testing  
**Completion**: ~75%

### ✅ Completed
- Foundation & Infrastructure
- Graph Engine (Neo4j)
- Discovery Service (Cartography)
- API Layer (REST/GraphQL/WebSocket)
- Dashboard UI with E2E tests
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

This project uses [@edcalderon/versioning](https://www.npmjs.com/package/@edcalderon/versioning) v1.4.7 for:

- ✅ Version synchronization across all packages
- ✅ Auto-generated workspace scripts (dev:all, build:all)
- ✅ Private package leak prevention
- ✅ Cleanup utilities
- ✅ Branch-aware versioning

All packages maintain version **0.1.0** in sync.

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
