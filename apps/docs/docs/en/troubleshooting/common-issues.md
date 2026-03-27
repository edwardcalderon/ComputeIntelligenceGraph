---
id: common-issues
title: Common Issues
description: Common CIG Issues and Solutions
sidebar_position: 2
---

# Common Issues

## Installation Issues

### Issue: pnpm install fails

**Solution**: Ensure you have Node.js 22.0+ and pnpm 9.0+ installed.

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

### Issue: Graph view is empty

**Solution**: Verify that:
1. Discovery has indexed resources
2. The Dashboard is on the expected graph source (`live` or `demo`)
3. The demo workspace was provisioned if you are using demo mode

### Issue: `Invalid or expired JWT token`

**Solution**:
1. Sign out and sign back in
2. Clear stale browser session storage if needed
3. Verify the production dashboard and API are using the same auth source

### Issue: Chat has no semantic context

**Solution**:
1. Confirm the API has `OPENAI_API_KEY` configured
2. Confirm Chroma is reachable
3. Redeploy the API so the semantic index sync runs

### Issue: Performance degradation

**Solution**: 
1. Check system resources (CPU, memory)
2. Optimize queries
3. Consider graph-source filtering and smaller result sets
