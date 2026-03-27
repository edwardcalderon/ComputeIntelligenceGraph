---
id: next-steps
title: Project Roadmap & TODOs
description: Future plans and immediate next steps for CIG
sidebar_position: 10
---

# Project Roadmap & TODOs

As the Compute Intelligence Graph system continues to evolve, these are the priority areas we are focusing on:

## 1. High-Priority Infrastructure

- [ ] **First API Production Deployment**: Successfully validate the **ECS/Fargate** container delivery on AWS via `@cig/infra`.
- [ ] **Cross-Cloud Auth Bridge**: Expand `@cig/auth` to support federation between Authentik and Supabase.
- [ ] **Zero-Trust Connectivity**: Implement WireGuard/VPN-less connectivity for the CLI to access local Neo4j instances in secure environments.

## 2. Intelligence & Agents

- [ ] **Agent Tool Expansion**: Add tools to `@cig/agents` for writing Cypher queries that can also modify the graph (Self-refining graph).
- [ ] **Multi-Cloud Cartography**: Fully implement and test the Google Cloud Platform (GCP) and Azure modules in `services/cartography`.
- [ ] **LLM Context Optimization**: Optimize the RAG pipeline in `@cig/chatbot` to handle extremely large infrastructure datasets (>100k nodes) efficiently.

## 3. Developer Experience

- [ ] **Feature-Complete SDK**: Finalize `@cig/sdk` to cover all CIG domain workflows, allowing for 100% type-safe interactions in both Dashboard and CLI.
- [ ] **Wizard-UI Implementation**: Move `apps/wizard-ui` from a placeholder "Coming Soon" to a functional installation wizard.
- [ ] **Comprehensive Test Coverage**: Increase E2E test coverage across the `@cig/api` surface, focusing on Graph-to-LLM handoffs.

## 4. UI/UX & Visualization

- [ ] **Advanced Graph Exploration**: Implement 3D graph visualization in the Dashboard for very complex network topologies.
- [ ] **Real-time Discovery Feedback**: Add detailed progress meters and log-streaming to the Dashboard during Cartography discovery jobs.

---

> [!TIP]
> This roadmap is maintained based on the current implementation state. For the most up-to-date work log, always refer to [PROJECT_STATUS.md](../../../PROJECT_STATUS.md) in the repository root.
