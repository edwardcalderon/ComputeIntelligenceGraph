---
id: endpoints
title: API Endpoints
description: CIG API Endpoints
sidebar_position: 2
---

# API Endpoints

The current API surface is organized around graph, chat, discovery, node-management, and operator workflows.

## Graph

- `GET /api/v1/graph/snapshot?source=live|demo`
- `POST /api/v1/graph/query`
- `POST /api/v1/graph/refine`
- `GET /api/v1/relationships`

## Resources

- `GET /api/v1/resources`
- `GET /api/v1/resources/search`
- `GET /api/v1/resources/:id`
- `GET /api/v1/resources/:id/dependencies`
- `GET /api/v1/resources/:id/dependents`

## Chat

- `POST /api/v1/chat`
- `POST /api/v1/chat/uploads`
- `POST /api/v1/chat/transcriptions`
- `GET /api/v1/chat/sessions`
- `GET /api/v1/chat/sessions/:id/messages`
- `PATCH /api/v1/chat/sessions/:id`
- `DELETE /api/v1/chat/sessions/:id`

## Demo Workspace

- `GET /api/v1/demo/status`
- `GET /api/v1/demo/snapshot`
- `POST /api/v1/demo/provision`

## Discovery

- `GET /api/v1/discovery/status`
- `POST /api/v1/discovery/trigger`

## Node Management

- `POST /api/v1/nodes/enroll`
- `POST /api/v1/nodes/heartbeat`
- `DELETE /api/v1/nodes/revoke`
- `GET /api/v1/nodes`
- `POST /api/v1/nodes/graph-delta`

## Operations

- `GET /api/v1/costs`
- `GET /api/v1/costs/breakdown`
- `GET /api/v1/security/findings`
- `GET /api/v1/security/score`
- `POST /api/v1/actions/execute`
- `POST /api/v1/newsletter/subscribe`
- `POST /api/v1/newsletter/unsubscribe`
- `GET /api/v1/newsletter/subscriptions`
