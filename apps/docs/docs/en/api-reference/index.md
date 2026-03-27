---
id: index
title: API Reference
description: CIG API Reference
sidebar_position: 1
---

# API Reference

Complete reference for the CIG API.

## Overview

The CIG API provides REST, GraphQL, WebSocket, and chat endpoints for accessing graph data, demo workspace snapshots, discovery status, and semantic retrieval.

## Base URL

```
https://api.cig.technology/api/v1
```

## Authentication

Most endpoints require a CIG session or bearer JWT. Public newsletter endpoints remain unauthenticated.

## Endpoints

- [Endpoints Documentation](./endpoints.md)

## Rate Limiting

API requests are rate limited per authenticated session or token.
