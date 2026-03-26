---
id: components
title: Components
description: CIG System Components
sidebar_position: 3
---

# Components

Overview of the main CIG system components.

## Core Components

### Compute Engine
The main computation engine that processes graph operations.

### Graph Database
Stores and manages graph data with efficient query support.

### API Layer
Provides RESTful API for external access to CIG functionality.

### UI Components
React-based components for user interaction.

## Component Interactions

Components interact through well-defined interfaces:

- Engine communicates with Database through query interface
- API Layer exposes Engine functionality
- UI Components call API endpoints
