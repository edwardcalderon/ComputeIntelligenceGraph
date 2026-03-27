---
id: next-steps
title: Project Roadmap & TODOs
description: Future plans and immediate next steps for CIG
sidebar_position: 10
---

# Project Roadmap & TODOs

As the Compute Intelligence Graph system continues to evolve, these are the priority areas we are focusing on:

## 1. High-Priority Infrastructure

- [ ] **First Live AWS Validation**: Validate the ECS/Fargate API deployment on AWS in a real customer-like environment.
- [ ] **Managed Demo Lifecycle**: Add admin-facing controls for reseeding and auditing the shared demo workspace.
- [ ] **Zero-Trust Connectivity**: Improve secure operator connectivity for self-hosted and managed node workflows.

## 2. Intelligence & Agents

- [ ] **Agent Refinement Hardening**: Expand `@cig/agents` with safer Cypher refinement previews and approvals.
- [ ] **Multi-Cloud Cartography**: Fully validate the Google Cloud Platform (GCP) and Azure modules in `services/cartography`.
- [ ] **LLM Context Optimization**: Improve the RAG pipeline for very large infrastructure datasets.

## 3. Developer Experience

- [ ] **Feature-Complete SDK**: Finalize `@cig/sdk` to cover all CIG domain workflows.
- [ ] **Wizard-UI Implementation**: Move `apps/wizard-ui` from placeholder to a functional installation wizard.
- [ ] **Comprehensive Test Coverage**: Increase E2E coverage across the `@cig/api` surface, focusing on graph-to-LLM handoffs.
- [ ] **Docs Coverage**: Keep Docusaurus aligned with the root README and release-aware project status.

## 4. UI/UX & Visualization

- [ ] **Graph UX Polish**: Improve source switching, search, and selection flows in the Dashboard.
- [ ] **Real-time Discovery Feedback**: Add more detailed progress meters and log-streaming during discovery jobs.

---

> [!TIP]
> This roadmap is maintained based on the current implementation state. For the most up-to-date work log, always refer to [Project Status](./project-status.md).
