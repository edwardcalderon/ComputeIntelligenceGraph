# Performance Testing

This document describes the performance benchmarks, targets, and testing methodology for the Compute Intelligence Graph (CIG) platform.

## Performance Targets

| Component | Metric | Target |
|---|---|---|
| API throughput | 100 concurrent requests | < 5 seconds total |
| Resource discovery | 1,000 resources | < 5 minutes |
| Graph queries | 10,000 nodes | < 500ms per query |
| Dashboard rendering | 500 nodes | < 2 seconds |
| Conversational interface | Response time | < 3 seconds |

These targets map to Requirements 24.1–24.5 and 26.9.

---

## Automated Performance Tests

The automated suite lives at `packages/api/src/performance.test.ts` and runs with vitest.

```bash
cd packages/api
npx vitest run performance.test.ts
```

### What is tested

- **100 concurrent requests to `/api/v1/health`** — all 100 complete within 5 seconds (Req 24.1)
- **`listResourcesPaged` with 10,000 mocked nodes** — returns within 500ms (Req 24.3)
- **`searchResources` with 10,000 mocked nodes** — returns within 500ms (Req 24.3)
- **Rate limiter burst handling** — allows exactly 100 requests per window, blocks the 101st (Req 26.9)
- **100 concurrent authenticated requests** — all handled (200 or 429) within 5 seconds (Req 24.1)

---

## Load Testing with k6

[k6](https://k6.io/) is the recommended tool for sustained load testing against a running instance.

### Install k6

```bash
# macOS
brew install k6

# Linux
sudo apt install k6
```

### Example: 100 concurrent users for 30 seconds

```javascript
// k6-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 100,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TOKEN = __ENV.API_TOKEN || '';

export default function () {
  const res = http.get(`${BASE_URL}/api/v1/health`);
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(0.1);
}
```

```bash
BASE_URL=http://localhost:8080 k6 run k6-load-test.js
```

### Example: Graph query stress test (10,000 nodes)

```javascript
// k6-graph-test.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  iterations: 100,
  thresholds: {
    http_req_duration: ['p(99)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TOKEN = __ENV.API_TOKEN;

export default function () {
  const res = http.get(`${BASE_URL}/api/v1/resources?limit=50`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(res, {
    'status 200': (r) => r.status === 200,
    'response < 500ms': (r) => r.timings.duration < 500,
  });
}
```

---

## Load Testing with autocannon

[autocannon](https://github.com/mcollina/autocannon) is a Node.js alternative for quick HTTP benchmarking.

```bash
npm install -g autocannon

# 100 concurrent connections for 10 seconds
autocannon -c 100 -d 10 http://localhost:8080/api/v1/health

# With auth header
autocannon -c 100 -d 10 \
  -H "Authorization: Bearer <token>" \
  http://localhost:8080/api/v1/resources
```

---

## Discovery Performance (1,000 resources < 5 minutes)

Discovery is handled by Cartography (Req 24.2). To benchmark:

1. Start the full stack: `docker compose up`
2. Trigger a discovery run: `POST /api/v1/discovery/trigger`
3. Poll `GET /api/v1/discovery/status` until `running: false`
4. Measure elapsed time from trigger to completion

Expected: a 1,000-resource AWS environment completes in under 5 minutes on standard hardware.

---

## Dashboard Rendering (500 nodes < 2 seconds)

The dashboard graph view at `/graph` uses React Flow. To benchmark rendering:

1. Open Chrome DevTools → Performance tab
2. Navigate to `/graph` with 500+ resources loaded
3. Record the page load and measure "Largest Contentful Paint" (LCP)

Target: LCP < 2 seconds with 500 nodes visible (Req 24.4).

For automated measurement, use Lighthouse CI:

```bash
npm install -g @lhci/cli
lhci autorun --collect.url=http://localhost:3000/graph
```

---

## Conversational Interface (< 3 seconds)

The chatbot endpoint processes NL queries via the OpenClaw/OpenFang agents (Req 24.5).

Benchmark with autocannon:

```bash
autocannon -c 10 -d 30 \
  -m POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -b '{"message":"How many EC2 instances are running?"}' \
  http://localhost:8080/api/v1/chat
```

Target: p95 response time < 3 seconds.

---

## Performance Optimization Tips

### API layer

- Enable HTTP/2 in production (Fastify supports it natively)
- Use connection pooling for Neo4j (`maxConnectionPoolSize: 50`)
- Cache frequently-read graph queries with Redis (TTL: 30s for resource lists)
- Use pagination (`limit`/`offset`) — never return unbounded result sets

### Graph queries

- Ensure Neo4j indexes exist on `Resource.id`, `Resource.type`, `Resource.provider`, `Resource.region`
- Use the full-text index `resource_search` for name/metadata searches
- Limit traversal depth to 3 hops (already enforced in `GraphQueryEngine`)

### Dashboard

- Virtualize the node list — only render visible nodes in the viewport
- Lazy-load resource details on click rather than upfront
- Use React Query's `staleTime` to avoid redundant API calls

### Rate limiting

- The default limit is 100 requests/minute per client IP or API key
- Adjust `createRateLimiter(limit, windowMs)` in `packages/api/src/rate-limit.ts` for your traffic profile
- Consider a sliding window algorithm for smoother burst handling in high-traffic deployments
