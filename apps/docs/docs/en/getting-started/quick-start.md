---
id: quick-start
title: Quick Start
description: Quick start guide for CIG
sidebar_position: 3
---

# Quick Start

Get your local CIG environment running in less than 5 minutes.

## 1. Prerequisites
Ensure you are using the latest long-term support versions:
*   **Node.js**: v22+
*   **pnpm**: v9+
*   **Docker & Docker Compose**

## 2. Install Dependencies
```bash
pnpm install
```

## 3. Environment & Configuration
CIG uses a specialized environment management system called `versioning`. You **must** sync and validate your environment before running any applications.

```bash
pnpm env:sync      # Synchronize .env files across the workspace
pnpm env:doctor    # Check for missing or invalid environment variables
pnpm env:validate  # Validate the full environment configuration
```

## 4. Local Infrastructure
CIG requires Neo4j, Postgres, and Redis to function locally. These are provided via Docker Compose.

```bash
docker-compose -f docker-compose.dev.yml up -d
```

## 5. Development Servers
In most cases, you'll want to run the API and the Dashboard.

```bash
# In separate terminal windows (or combined via concurrently)
pnpm dev:api
pnpm dev:dashboard
```

Alternatively, to launch the entire workspace:
```bash
pnpm dev:all
```

## 6. Local Endpoints
Once the servers are up, access them here:
*   **Landing Page**: `http://localhost:3000`
*   **Dashboard**: `http://localhost:3001`
*   **API (Public)**: `http://localhost:3003`
*   **Graph Browser (Neo4j)**: `http://localhost:7474` (Default user: `neo4j`, Password: `password`)
*   **Documentation**: `http://localhost:3004`
