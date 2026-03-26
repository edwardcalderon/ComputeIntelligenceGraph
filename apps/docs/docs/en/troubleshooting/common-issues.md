---
id: common-issues
title: Common Issues
description: Common CIG Issues and Solutions
sidebar_position: 2
---

# Common Issues

## Installation Issues

### Issue: pnpm install fails

**Solution**: Ensure you have Node.js 20.0+ and pnpm 9.0+ installed.

```bash
node --version
pnpm --version
```

### Issue: Port already in use

**Solution**: Change the port or kill the process using the port.

```bash
# Use a different port
PORT=3001 pnpm dev

# Or kill the process
lsof -ti:3000 | xargs kill -9
```

## Runtime Issues

### Issue: Graph query returns empty results

**Solution**: Verify that:
1. Data has been loaded into the graph
2. Query syntax is correct
3. Indexes are properly configured

### Issue: Performance degradation

**Solution**: 
1. Check system resources (CPU, memory)
2. Optimize queries
3. Consider data partitioning
