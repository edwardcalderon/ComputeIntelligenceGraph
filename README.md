<h1 align="center">CIG</h1>

<p align="center">
  <img src="assets/cig-icon.svg" alt="CIG logo" width="160" />
</p>

<p align="center">
  <strong>Compute Intelligence Graph</strong><br />
  Self-hosted infrastructure intelligence for discovery, graph modeling, querying, cost analysis, and security review.
</p>

<p align="center">
  <a href="package.json"><img src="https://img.shields.io/badge/version-0.2.0-blue.svg" alt="Version" /></a>
  <a href="package.json"><img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg" alt="Node" /></a>
  <a href="package.json"><img src="https://img.shields.io/badge/pnpm-%3E%3D9.0.0-orange.svg" alt="pnpm" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License" /></a>
</p>

<p align="center">
  <a href="#english">English</a> |
  <a href="#espanol">Español</a> |
  <a href="#zhongwen">中文</a>
</p>

<p align="center">
  <a href="https://cig.lat/">https://cig.lat/</a>
</p>

## Shared Links

- Documentation index: [docs/README.md](docs/README.md)
- Project status: [PROJECT_STATUS.md](PROJECT_STATUS.md)
- Architecture: [docs/architecture/README.md](docs/architecture/README.md)
- Development: [docs/development/README.md](docs/development/README.md)
- Deployment: [docs/deployment/README.md](docs/deployment/README.md)
- Authentication: [docs/authentication/README.md](docs/authentication/README.md)

## <a id="english"></a>English

### Overview

Compute Intelligence Graph is a monorepo for a self-hosted platform focused on:

- infrastructure discovery
- graph-based modeling and querying
- cost and security analysis
- dashboard and API workflows
- CLI and deployment tooling

### System Foundations

- `packages/api` is the canonical domain API and the target public API surface for `https://api.cig.technology/`
- `apps/dashboard` is the protected UI shell; internal Next.js routes should stay limited to web-session, auth-relay, and browser-bridge concerns
- `packages/sdk` is the shared typed client foundation for dashboard and CLI, with an optional follow-up path to absorb higher-level CIG business workflows
- `packages/iac` owns AWS API core data such as networking and Neo4j, while `packages/infra` owns the ECS/Fargate runtime delivery path

### Repository Layout

```text
apps/
  dashboard/     Main Next.js dashboard UI
  landing/       Public landing site
  wizard-ui/     Installation wizard scaffold
packages/
  agents/        Agent logic
  api/           Fastify REST, GraphQL, and WebSocket API
  auth/          Authentication helpers and session management
  chatbot/       RAG and retrieval pipeline
  cli/           CLI commands and credential handling
  config/        YAML config loading and validation
  discovery/     Discovery orchestration and scheduler
  graph/         Neo4j graph engine
  iac/           Terraform modules
  infra/         AWS deployment wrapper
  sdk/           Shared typed API client foundation
services/
  cartography/   Python FastAPI discovery service
infra/
  docker/        Container build definitions
docs/            Project documentation
```

### Quick Start

#### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Engine or Docker Desktop
- Docker Compose

#### Install

```bash
pnpm install
```

#### Sync environment files

```bash
pnpm env:sync
pnpm env:doctor
pnpm env:validate
```

#### Start local infrastructure

```bash
docker-compose -f docker-compose.dev.yml up -d
```

#### Start the apps you need

```bash
pnpm dev:landing
pnpm dev:dashboard
pnpm dev:api
```

Run the whole workspace if needed:

```bash
pnpm dev:all
```

### Common Commands

```bash
pnpm build
pnpm test
pnpm lint
pnpm version:validate
pnpm version:status
```

### Contact

- Support: [support@cig.technolgy](mailto:support@cig.technolgy)
- Development: [dev@cig.technolgy](mailto:dev@cig.technolgy)
- General contact: [contact@cig.technology](mailto:contact@cig.technology)

## <a id="espanol"></a>Español

### Resumen

Compute Intelligence Graph es un monorepo para una plataforma self-hosted enfocada en:

- descubrimiento de infraestructura
- modelado y consultas basadas en grafos
- análisis de costos y seguridad
- flujos de trabajo con dashboard y API
- herramientas de CLI y despliegue

### Fundamentos del Sistema

- `packages/api` es la API de dominio canónica y la superficie pública objetivo para `https://api.cig.technology/`
- `apps/dashboard` es la interfaz protegida; las rutas internas de Next.js deben limitarse a sesión web, relay de autenticación y puentes del navegador
- `packages/sdk` es la base compartida del cliente tipado para dashboard y CLI, con un seguimiento opcional para encapsular flujos de negocio de CIG de mayor nivel
- `packages/iac` es responsable del core data del API en AWS, como networking y Neo4j, mientras `packages/infra` gestiona el runtime en ECS/Fargate

### Estructura del Repositorio

```text
apps/
  dashboard/     Interfaz principal en Next.js
  landing/       Sitio público
  wizard-ui/     Asistente de instalación
packages/
  agents/        Lógica de agentes
  api/           API Fastify REST, GraphQL y WebSocket
  auth/          Ayudas de autenticación y sesiones
  chatbot/       Pipeline de RAG y recuperación
  cli/           Comandos CLI y credenciales
  config/        Carga y validación de YAML
  discovery/     Orquestación y scheduler de discovery
  graph/         Motor de grafos con Neo4j
  iac/           Módulos Terraform
  infra/         Wrapper de despliegue en AWS
  sdk/           Base compartida del cliente tipado de API
services/
  cartography/   Servicio Python FastAPI para discovery
infra/
  docker/        Definiciones de contenedores
docs/            Documentación del proyecto
```

### Inicio Rápido

#### Requisitos

- Node.js 20+
- pnpm 9+
- Docker Engine o Docker Desktop
- Docker Compose

#### Instalación

```bash
pnpm install
```

#### Sincronizar archivos de entorno

```bash
pnpm env:sync
pnpm env:doctor
pnpm env:validate
```

#### Levantar la infraestructura local

```bash
docker-compose -f docker-compose.dev.yml up -d
```

#### Iniciar las aplicaciones necesarias

```bash
pnpm dev:landing
pnpm dev:dashboard
pnpm dev:api
```

Para iniciar todo el workspace:

```bash
pnpm dev:all
```

### Comandos Comunes

```bash
pnpm build
pnpm test
pnpm lint
pnpm version:validate
pnpm version:status
```

### Contacto

- Soporte: [support@cig.technolgy](mailto:support@cig.technolgy)
- Desarrollo: [dev@cig.technolgy](mailto:dev@cig.technolgy)
- Contacto general: [contact@cig.technology](mailto:contact@cig.technology)

## <a id="zhongwen"></a>中文

### 概述

Compute Intelligence Graph 是一个面向自托管基础设施智能平台的 monorepo，重点包括：

- 基础设施发现
- 图模型与图查询
- 成本与安全分析
- Dashboard 与 API 工作流
- CLI 与部署工具

### 系统基础

- `packages/api` 是规范的领域 API，也是 `https://api.cig.technology/` 的目标公共 API 表面
- `apps/dashboard` 是受保护的 UI 外壳；内部 Next.js 路由应只处理 Web 会话、认证中继和浏览器桥接问题
- `packages/sdk` 是 Dashboard 与 CLI 共用的强类型客户端基础层，后续可选择继续承载更高层的 CIG 业务工作流
- `packages/iac` 负责 AWS 中 API 的核心数据基础设施，例如网络层与 Neo4j，`packages/infra` 负责 ECS/Fargate 运行时交付

### 仓库结构

```text
apps/
  dashboard/     主要的 Next.js 控制台
  landing/       对外公开站点
  wizard-ui/     安装向导脚手架
packages/
  agents/        智能体逻辑
  api/           Fastify REST、GraphQL 与 WebSocket API
  auth/          认证与会话辅助模块
  chatbot/       RAG 与检索流水线
  cli/           CLI 命令与凭据处理
  config/        YAML 配置加载与校验
  discovery/     发现编排与调度
  graph/         Neo4j 图引擎
  iac/           Terraform 模块
  infra/         AWS 部署封装
  sdk/           共享强类型 API 客户端基础层
services/
  cartography/   Python FastAPI 发现服务
infra/
  docker/        容器构建定义
docs/            项目文档
```

### 快速开始

#### 环境要求

- Node.js 20+
- pnpm 9+
- Docker Engine 或 Docker Desktop
- Docker Compose

#### 安装

```bash
pnpm install
```

#### 同步环境文件

```bash
pnpm env:sync
pnpm env:doctor
pnpm env:validate
```

#### 启动本地基础设施

```bash
docker-compose -f docker-compose.dev.yml up -d
```

#### 启动需要的应用

```bash
pnpm dev:landing
pnpm dev:dashboard
pnpm dev:api
```

如需启动整个工作区：

```bash
pnpm dev:all
```

### 常用命令

```bash
pnpm build
pnpm test
pnpm lint
pnpm version:validate
pnpm version:status
```

### 联系方式

- 技术支持: [support@cig.technolgy](mailto:support@cig.technolgy)
- 开发团队: [dev@cig.technolgy](mailto:dev@cig.technolgy)
- 综合联系: [contact@cig.technology](mailto:contact@cig.technology)

## License

[MIT](LICENSE)
