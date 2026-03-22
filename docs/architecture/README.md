# Architecture Notes

## What Exists Today

### Working Core Platform

- `apps/dashboard` provides the main UI
- `packages/api` provides REST, GraphQL, WebSocket, auth, and metrics
- `packages/graph` provides the Neo4j graph engine
- `packages/discovery` and `services/cartography` provide discovery orchestration and cloud inventory collection
- `packages/chatbot` and `packages/agents` provide retrieval, query reasoning, and action workflows
- `packages/cli` provides operational and setup commands

### Partial or Incomplete Areas

- `apps/landing` is minimal and not yet a full product site
- `apps/wizard-ui` is scaffolded only
- `packages/sdk` is scaffolded and not yet complete

## High-Level Layout

```text
Dashboard UI -> API -> Graph Engine / Discovery / Chatbot / Agents
                                 -> Neo4j
                                 -> Chroma
Discovery Service -> Cartography -> Cloud Providers
CLI -> Local config / deployment / orchestration workflows
```

## Historical Design Docs

- Current generated status snapshot: [../../PROJECT_STATUS.md](../../PROJECT_STATUS.md)
- Archived blueprint material: [../archive/CIG_final_blueprint.md](../archive/CIG_final_blueprint.md)
- CLI/runtime implementation snapshot: [cli-current-state.md](cli-current-state.md)

Use the implementation in `apps/`, `packages/`, and `services/` as the source of truth when these documents diverge.
