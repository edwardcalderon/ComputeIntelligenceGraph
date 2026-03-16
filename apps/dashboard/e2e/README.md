# Dashboard E2E Tests

End-to-end tests for the CIG Dashboard using Playwright.

## Test Coverage

### Navigation Tests (`navigation.spec.ts`)
- Page navigation between Overview, Resources, Graph, Costs, and Security
- Dark mode toggle functionality
- URL routing verification

### Resources Tests (`resources.spec.ts`)
- Resource list display
- Filtering by type, provider, and state
- Search functionality
- Multiple filter combinations
- Clear filters functionality
- Pagination
- Navigation to resource detail pages

### Graph Visualization Tests (`graph.spec.ts`)
- Graph canvas rendering
- Graph statistics display
- Filtering by type and provider
- Node selection and detail panel
- Connected node highlighting
- Graph controls (zoom, pan)
- Provider legend display
- Empty state handling

### Real-time Updates Tests (`realtime-updates.spec.ts`)
- WebSocket connection establishment
- WebSocket reconnection on connection loss
- Resource update message handling
- Discovery complete message handling
- Malformed message handling

## Running Tests

### Run all tests
```bash
pnpm test:e2e
```

### Run tests in UI mode (interactive)
```bash
pnpm test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
pnpm test:e2e:headed
```

### Run tests in debug mode
```bash
pnpm test:e2e:debug
```

### Run specific test file
```bash
pnpm test:e2e navigation.spec.ts
```

## Configuration

Test configuration is in `playwright.config.ts`:
- Base URL: `http://localhost:3000` (configurable via `BASE_URL` env var)
- Test directory: `./e2e`
- Automatic dev server startup
- Screenshot on failure
- Trace on first retry

## Prerequisites

- Dashboard dev server running on port 3000 (auto-started by Playwright)
- API server running on port 8080 (configure via `NEXT_PUBLIC_API_URL`)

## CI/CD Integration

Tests are configured for CI environments:
- Retries: 2 attempts on failure
- Workers: 1 (sequential execution)
- Server reuse: Disabled in CI

## Writing New Tests

1. Create a new `.spec.ts` file in the `e2e` directory
2. Import test utilities from `@playwright/test`
3. Use `test.describe()` to group related tests
4. Use `test.beforeEach()` for common setup
5. Write assertions using `expect()`

Example:
```typescript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/my-page');
  });

  test('should do something', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Expected Text');
  });
});
```

## Troubleshooting

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Check if API server is running
- Verify network connectivity

### WebSocket tests failing
- Ensure WebSocket endpoint is accessible
- Check browser console for errors
- Verify WebSocket URL configuration

### Flaky tests
- Add explicit waits using `page.waitForSelector()`
- Use `page.waitForTimeout()` sparingly
- Increase retry count in CI
