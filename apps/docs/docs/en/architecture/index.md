---
id: index
title: Architecture
description: CIG System Architecture
sidebar_position: 1
---

# Architecture

Learn about the CIG system architecture and design.

## System Overview

CIG is built on a modular architecture with the following components:

- **Core Engine**: The main computation engine
- **Graph Database**: Stores and manages graph data
- **API Layer**: RESTful API for external access
- **UI Components**: React-based user interface

## Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        UI[User Interface]
    end
    
    subgraph "API Layer"
        API[REST API]
    end
    
    subgraph "Core Layer"
        ENGINE[Compute Engine]
        DB[Graph Database]
    end
    
    UI --> API
    API --> ENGINE
    ENGINE --> DB
```

## Next Steps

- [System Design](./system-design.md)
- [Components](./components.md)
