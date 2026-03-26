---
id: endpoints
title: API Endpoints
description: CIG API Endpoints
sidebar_position: 2
---

# API Endpoints

## Graph Operations

### List all graphs

```
GET /graphs
```

### Create a new graph

```
POST /graphs
```

### Get a specific graph

```
GET /graphs/:graphId
```

### Update a graph

```
PUT /graphs/:graphId
```

### Delete a graph

```
DELETE /graphs/:graphId
```

## Node Operations

### List nodes in a graph

```
GET /graphs/:graphId/nodes
```

### Create a new node

```
POST /graphs/:graphId/nodes
```

### Get a specific node

```
GET /graphs/:graphId/nodes/:nodeId
```

### Update a node

```
PUT /graphs/:graphId/nodes/:nodeId
```

### Delete a node

```
DELETE /graphs/:graphId/nodes/:nodeId
```
