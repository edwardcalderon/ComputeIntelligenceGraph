# E2E Testing Quick Start Guide

## Prerequisites

1. Install dependencies:
```bash
pnpm install
```

2. Install Playwright browsers:
```bash
npx playwright install chromium
```

## Running Tests

### Basic Commands

```bash
# Run all tests (headless)
pnpm test:e2e

# Run tests with UI (recommended for development)
pnpm test:e2e:ui

# Run tests in headed mode (see browser)
pnpm test:e2e:headed

# Run specific test file
pnpm test:e2e navigation.spec.ts

# Run tests matching pattern
pnpm test:e2e --grep "filter"
```

### Debug Mode

```bash
# Debug specific test
pnpm test:e2e:debug navigation.spec.ts

# Debug with Playwright Inspector
PWDEBUG=1 pnpm test:e2e
```

## Test Structure

```
e2e/
├── navigation.spec.ts       # Page navigation tests
├── resources.spec.ts        # Resource filtering/search tests
├── graph.spec.ts           # Graph visualization tests
├── realtime-updates.spec.ts # WebSocket tests
├── user-journey.spec.ts    # Complete user workflows
├── fixtures.ts             # Test utilities and mocks
├── README.md               # Detailed documentation
├── TEST_COVERAGE.md        # Coverage summary
└── QUICK_START.md          # This file
```

## Writing Your First Test

1. Create a new file: `e2e/my-feature.spec.ts`

2. Add basic test structure:
```typescript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/my-page');
  });

  test('should do something', async ({ page }) => {
    // Arrange
    const button = page.locator('button:has-text("Click me")');
    
    // Act
    await button.click();
    
    // Assert
    await expect(page.locator('h1')).toContainText('Success');
  });
});
```

3. Run your test:
```bash
pnpm test:e2e my-feature.spec.ts
```

## Common Patterns

### Waiting for Elements
```typescript
// Wait for element to be visible
await page.waitForSelector('.my-element', { timeout: 5000 });

// Wait for navigation
await page.waitForURL('/expected-url');

// Wait for specific timeout (use sparingly)
await page.waitForTimeout(1000);
```

### Selecting Elements
```typescript
// By text
page.locator('button:has-text("Submit")');

// By role
page.getByRole('button', { name: 'Submit' });

// By test ID
page.locator('[data-testid="submit-button"]');

// By CSS selector
page.locator('.submit-button');
```

### Assertions
```typescript
// Visibility
await expect(element).toBeVisible();
await expect(element).not.toBeVisible();

// Text content
await expect(element).toContainText('Expected');
await expect(element).toHaveText('Exact text');

// URL
await expect(page).toHaveURL('/expected-path');
await expect(page).toHaveURL(/pattern/);

// Value
await expect(input).toHaveValue('expected value');
```

### Conditional Logic
```typescript
// Check if element exists
if (await element.isVisible()) {
  await element.click();
}

// Count elements
const count = await page.locator('.item').count();
if (count > 0) {
  // Do something
}
```

## Troubleshooting

### Test Timeout
```typescript
// Increase timeout for specific test
test('slow test', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // ... test code
});
```

### Flaky Tests
- Add explicit waits: `await page.waitForSelector()`
- Use `waitForLoadState()`: `await page.waitForLoadState('networkidle')`
- Avoid `waitForTimeout()` when possible
- Use retry logic in CI

### Debugging
```bash
# Run with headed browser
pnpm test:e2e:headed

# Run with Playwright Inspector
pnpm test:e2e:debug

# Generate trace
pnpm test:e2e --trace on
```

### View Test Report
```bash
# After running tests
npx playwright show-report
```

## Best Practices

1. **Use descriptive test names**
   ```typescript
   test('should filter resources by compute type', async ({ page }) => {
     // ...
   });
   ```

2. **Group related tests**
   ```typescript
   test.describe('Resource Filtering', () => {
     // Multiple related tests
   });
   ```

3. **Use beforeEach for setup**
   ```typescript
   test.beforeEach(async ({ page }) => {
     await page.goto('/resources');
   });
   ```

4. **Keep tests independent**
   - Each test should work in isolation
   - Don't rely on test execution order

5. **Use explicit waits**
   - Wait for elements before interacting
   - Don't use arbitrary timeouts

6. **Clean assertions**
   - One logical assertion per test
   - Use descriptive error messages

## Environment Variables

```bash
# Custom base URL
BASE_URL=http://localhost:3001 pnpm test:e2e

# API URL
NEXT_PUBLIC_API_URL=http://localhost:8080 pnpm test:e2e

# CI mode
CI=true pnpm test:e2e
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Test Coverage Summary](./TEST_COVERAGE.md)
- [Detailed README](./README.md)
