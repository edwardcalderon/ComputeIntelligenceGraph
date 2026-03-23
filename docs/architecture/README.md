# Architecture Notes

Last synchronized with the root README and release state on `2026-03-23`.

## Current Runtime Roles

| Area | Path | Current role |
| --- | --- | --- |
| Landing | `apps/landing` | Public site, login entrypoint, and canonical logout return surface |
| Dashboard | `apps/dashboard` | Main protected Next.js dashboard UI |
| API | `packages/api` | Fastify REST, GraphQL, WebSocket, auth, and metrics |
| Graph engine | `packages/graph` | Neo4j-backed graph modeling and traversal |
| Discovery | `packages/discovery` | Discovery orchestration and scheduler |
| Cartography service | `services/cartography` | Python discovery worker/service |
| Chatbot | `packages/chatbot` | Retrieval and RAG pipeline |
| Agents | `packages/agents` | Query reasoning and action workflows |
| CLI | `packages/cli` | Install, connect, bootstrap, enroll, and operator commands |
| Auth helpers | `packages/auth` | Shared authentication/session helpers |
| Infra wrapper | `packages/infra` | Deployment wrapper around infrastructure tooling |

## Supporting Packages

These packages are part of the active repository shape even if they are not the primary end-user entrypoints:

- `packages/config` for configuration loading and validation
- `packages/i18n` for translations and localization utilities
- `packages/ui` for shared UI primitives
- `packages/node-runtime` for node runtime assets
- `packages/runtime-contracts` for shared runtime contracts
- `packages/iac` for Terraform modules and environment layouts

## Areas Still Evolving

- `apps/wizard-ui` is still a minimal placeholder
- `packages/sdk` is scaffolded and not feature-complete
- Deployment and operator flows are more mature than the wizard surface

## High-Level Layout

```text
Landing (cig.lat) -> Dashboard auth relay / login callback -> Authentik
Landing / Dashboard -> API -> Graph / Discovery / Chatbot / Agents
                                 -> Neo4j
                                 -> Chroma
Discovery orchestration -> Cartography -> Cloud providers
CLI -> local config / enrollment / install assets / compose workflows
Infra wrapper -> Terraform modules / container deployment surfaces
```

## Related Docs

- Status snapshot: [../../PROJECT_STATUS.md](../../PROJECT_STATUS.md)
- Development notes: [../development/README.md](../development/README.md)
- Deployment notes: [../deployment/README.md](../deployment/README.md)
- Authentication notes: [../authentication/README.md](../authentication/README.md)
- Archived blueprint material: [../archive/CIG_final_blueprint.md](../archive/CIG_final_blueprint.md)
- CLI/runtime implementation snapshot: [cli-current-state.md](cli-current-state.md)

Use the implementation in `apps/`, `packages/`, `services/`, and `infra/` as the source of truth when documents drift.
