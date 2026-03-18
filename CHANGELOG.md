# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-03-18

### Features

* **infra:** add `@cig/infra` deployment wrapper package — ConfigManager, Logger, InfraWrapper, IACIntegration, AuthentikDeployer, DashboardDeployer, CLI entry point, full error hierarchy, 37+ tests ([8a65090](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/8a65090914f59e95f3ee2bde964aa662eb9fe888))
* **auth:** add `@cig/auth` package with Supabase OAuth + multi-method sign-in modal ([598d8e6](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/598d8e6a908a8d143a5ad25fe92a41e05b1b178b))
* display app version from root package.json in all app footers ([53c6dd6](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/53c6dd6f3d18e23b34642b2dbc5b817129b3c90d))
* upgrade to @edcalderon/versioning v1.4.7 with workspace-scripts ([b6a8bdf](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/b6a8bdfc0e176234791ee5645987238139a57b43))
* **landing:** animated hero sequence, space particles, cursor-driven graph typography, scroll animations ([2e3cd9d](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/2e3cd9d25952e3403fa8c1d4255f89011f67b945))
* **landing:** add CIG favicon, manifest PNGs, inline SVG icon ([9b8741b](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/9b8741ba5db1cdaa081ba194798a6834f70b66e6))

### Bug Fixes

* resolve lint failures across all workspace packages ([cff4945](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/cff49457b02415d9e10c9b1e0520bb2dfc8105e3))
* resolve remaining type errors in chatbot and api packages ([2cfb206](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/2cfb2062f67400bce997ab0c89b7a99c8d443d7c))
* **landing:** add basePath/assetPrefix for GitHub Pages subpath deployment ([7a03216](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/7a03216b5dfd3c1e60b6754903ed7c4b6e51c5eb))
* set cig.lat as primary domain and keep legacy fallback ([621aa54](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/621aa54e3172664bc9620838123393078ea878b3))

## [0.1.1] - 2026-03-16

### Features

* initial monorepo setup with pnpm + TurboRepo
* Neo4j graph engine with traversal, circular dependency detection, 61 unit tests
* Fastify API with REST, GraphQL, WebSocket, auth, rate limiting, 108 tests
* Next.js 14 dashboard with resource views, graph visualization, costs, security, 37+ E2E tests
* Python Cartography discovery service + TypeScript orchestrator
* RAG/chatbot pipeline with OpenAI embeddings and LangChain
* OpenClaw query reasoning agent + OpenFang action execution agent
* CLI tool (`cig` command) with install, connect, deploy, seed, reset, status
* Docker Compose and Terraform infrastructure scaffolding
* Multi-cloud support (AWS, GCP, Kubernetes)
* Cost and security dashboards

[0.1.2]: https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/edwardcalderon/ComputeIntelligenceGraph/releases/tag/v0.1.1
