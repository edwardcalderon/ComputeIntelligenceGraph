import { test, expect } from '@playwright/test';

test.describe('Complete User Journey', () => {
  test('should complete full dashboard exploration workflow', async ({ page }) => {
    // 1. Start at overview page
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Overview');
    
    // 2. View resource statistics
    await expect(page.locator('text=/Total Resources/i')).toBeVisible();
    await expect(page.locator('text=/By Type/i')).toBeVisible();
    await expect(page.locator('text=/By Provider/i')).toBeVisible();
    
    // 3. Navigate to resources page
    await page.click('a[href="/resources"]');
    await expect(page).toHaveURL('/resources');
    
    // 4. Filter resources by type
    await page.selectOption('select:has-text("All types")', 'compute');
    await expect(page).toHaveURL(/type=compute/);
    
    // 5. Search for specific resource
    await page.locator('input[type="search"]').fill('web');
    await expect(page).toHaveURL(/search=web/);
    
    // 6. Clear filters
    const clearButton = page.locator('button:has-text("Clear filters")');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await expect(page).toHaveURL('/resources');
    }
    
    // 7. Navigate to graph visualization
    await page.click('a[href="/graph"]');
    await expect(page).toHaveURL('/graph');
    await page.waitForSelector('.react-flow', { timeout: 5000 });
    
    // 8. Interact with graph
    const nodes = page.locator('.react-flow__node');
    const nodeCount = await nodes.count();
    
    if (nodeCount > 0) {
      // Click on a node
      await nodes.first().click();
      await page.waitForTimeout(300);
      
      // Verify detail panel appears
      const detailPanel = page.locator('div:has-text("Name")').filter({ hasText: 'ID' });
      await expect(detailPanel).toBeVisible();
      
      // Close detail panel
      await page.click('button[aria-label="Close"]');
      await page.waitForTimeout(300);
    }
    
    // 9. Filter graph by provider
    await page.selectOption('select:has-text("All providers")', 'aws');
    await page.waitForTimeout(500);
    
    // 10. Navigate to costs page
    await page.click('a[href="/costs"]');
    await expect(page).toHaveURL('/costs');
    
    // 11. Navigate to security page
    await page.click('a[href="/security"]');
    await expect(page).toHaveURL('/security');
    
    // 12. Return to overview
    await page.click('a[href="/"]');
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toContainText('Overview');
  });

  test('should handle resource detail navigation', async ({ page }) => {
    // Navigate to resources
    await page.goto('/resources');
    
    // Wait for resources to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });
    
    // Click on first resource
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();
    
    // Verify we're on detail page
    await expect(page).toHaveURL(/\/resources\/.+/);
    
    // Navigate back to resources list
    await page.goBack();
    await expect(page).toHaveURL('/resources');
  });

  test('should persist filters across page navigation', async ({ page }) => {
    // Navigate to resources with filters
    await page.goto('/resources?type=compute&provider=aws');
    
    // Verify filters are applied
    await expect(page.locator('select:has-text("Compute")')).toHaveValue('compute');
    await expect(page.locator('select:has-text("AWS")')).toHaveValue('aws');
    
    // Navigate away and back
    await page.click('a[href="/graph"]');
    await page.goBack();
    
    // Verify filters are still applied
    await expect(page).toHaveURL(/type=compute/);
    await expect(page).toHaveURL(/provider=aws/);
  });

  test('should handle dark mode across pages', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    
    // Enable dark mode
    await page.click('button[aria-label="Toggle dark mode"]');
    await expect(html).toHaveClass(/dark/);
    
    // Navigate to different pages
    await page.click('a[href="/resources"]');
    await expect(html).toHaveClass(/dark/);
    
    await page.click('a[href="/graph"]');
    await expect(html).toHaveClass(/dark/);
    
    // Disable dark mode
    await page.click('button[aria-label="Toggle dark mode"]');
    await expect(html).not.toHaveClass(/dark/);
  });

  test('should handle empty states gracefully', async ({ page }) => {
    // Navigate to resources with filters that return no results
    await page.goto('/resources');
    
    // Apply multiple restrictive filters
    await page.selectOption('select:has-text("All types")', 'compute');
    await page.selectOption('select:has-text("All providers")', 'gcp');
    await page.selectOption('select:has-text("All states")', 'terminated');
    
    // Wait for results
    await page.waitForTimeout(1000);
    
    // Check for empty state or no results message
    const tableBody = page.locator('table tbody');
    const emptyMessage = page.locator('text=/No resources match/i');
    
    // Either empty message or empty table should be present
    const hasEmptyMessage = await emptyMessage.isVisible();
    const rowCount = await tableBody.locator('tr').count();
    
    if (hasEmptyMessage) {
      await expect(emptyMessage).toBeVisible();
    } else if (rowCount === 1) {
      // Single row with "no resources" message
      await expect(tableBody.locator('td[colspan]')).toBeVisible();
    }
  });
});
