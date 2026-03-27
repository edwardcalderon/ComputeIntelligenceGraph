---
id: components
title: Components
description: CIG System Components
sidebar_position: 3
---

# Component Breakdown

CIG is a monorepo containing specialized packages that work together to provide a seamless infrastructure intelligence experience.

## Application Surfaces

### `apps/landing`
*   **Role**: Public facing landing page.
*   **Tech**: Next.js.
*   **Purpose**: Product showcase, authentication entry point, and canonical logout return surface.

### `apps/dashboard`
*   **Role**: Primary user interface.
*   **Tech**: Next.js (App Router), Tailwind CSS.
*   **Purpose**: Infrastructure visualization, live/demo graph switching, graph exploration, agent chat, and settings management.

### `apps/wizard-ui`
*   **Role**: Guided installation.
*   **Purpose**: Helps new users set up their self-hosted environment and initial discovery jobs.

## Core Packages

### `@cig/api`
*   **Role**: Central Domain Server.
*   **Core Tech**: Fastify, GraphQL, WebSocket, Prometheus, Zod.
*   **Responsibility**: Orchestrates all logic between the UI, graph, discovery, semantic retrieval, and chat layers.

### `@cig/graph`
*   **Role**: Graph Engine.
*   **Core Tech**: Neo4j (Cypher), Neo4j-Driver.
*   **Responsibility**: Manages the graph schema, handles complex traversals, applies scope filters, and ensures data integrity.

### `@cig/discovery`
*   **Role**: Discovery Orchestrator.
*   **Responsibility**: Schedules discovery cycles, triggers the `cartography` service, and updates the graph state.

### `@cig/auth`
*   **Role**: Authentication & Session Hub.
*   **Core Tech**: `jose`, `jsonwebtoken`, Authentik.
*   **Responsibility**: Ensures secure access to the API and manages cross-platform user sessions for Authentik and Supabase-backed flows.

### `@cig/sdk`
*   **Role**: Typed Client Foundation.
*   **Responsibility**: A shared library providing typed API clients for the Dashboard and CLI, ensuring type safety throughout the codebase.

## Intelligence & Agents

### `@cig/agents`
*   **Role**: AI Reasoning Engine.
*   **Core Tech**: LangChain, OpenAI/Anthropic.
*   **Responsibility**: Implements the tool-calling logic that allows LLMs to query and refine the infrastructure graph.

### `@cig/chatbot`
*   **Role**: RAG Pipeline.
*   **Responsibility**: Manages vector ingest and retrieval to provide context to the agentic layer, including managed semantic collection scopes.

## Infrastructure & Operator Tools

### `@cig/iac`
*   **Role**: Infrastructure as Code.
*   **Tech**: Terraform.
*   **Responsibility**: Defines the AWS base infrastructure required to run CIG.

### `@cig/infra`
*   **Role**: Deployment Wrapper.
*   **Tech**: SST (Serverless Stack).
*   **Responsibility**: Manages the runtime delivery of containers to ECS/Fargate.

### `@cig-technology/cli`
*   **Role**: Operator Command Line.
*   **Responsibility**: Deployment, bootstrapping, environment management, demo provisioning, and terminal-based querying.

## Services

### `services/cartography` (Python)
*   **Role**: Raw Discovery Data Engine.
*   **Tech**: FastAPI, Python Cartography.
*   **Responsibility**: The worker service that connects to cloud APIs (AWS/GCP/Azure) and pushes raw data into Neo4j.

### Vector Store (Chroma)
*   **Role**: Specialized Vector Semantic Engine.
*   **Responsibility**: Powers the RAG pipeline by storing infrastructure metadata as high-dimensional embeddings for semantic retrieval. Managed deployments scope collections by tenant/workspace; demo mode uses the shared seeded demo workspace scope.
