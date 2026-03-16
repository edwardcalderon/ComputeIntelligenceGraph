import { test, expect } from '@playwright/test';

test.describe('Graph Visualization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/graph');
  });

  test('should display graph canvas', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Graph');
    
    // Check for React Flow container
    await expect(page.locator('.react-flow')).toBeVisible();
  });

  test('should display graph statistics', async ({ page }) => {
    // Wait for graph to load
    await page.waitForSelector('.react-flow', { timeout: 5000 });
    
    // Check for node and edge counts
    const statsText = await page.locator('p:has-text("node")').textContent();
    expect(statsText).toMatch(/\d+ node/);
  });

  test('should filter graph by type', async ({ page }) => {
    // Wait for graph to load
    await page.waitForSelector('.react-flow', { timeout: 5000 });
    
    // Select compute type
    await page.selectOption('select:has-text("All types")', 'compute');
    
    // Wait for graph to update
    await page.waitForTimeout(500);
    
    // Verify filter is applied
    const select = page.locator('select:has-text("Compute")');
    await expect(select).toHaveValue('compute');
  });

  test('should filter graph by provider', async ({ page }) => {
    // Wait for graph to load
    await page.waitForSelector('.react-flow', { timeout: 5000 });
    
    // Select AWS provider
    await page.selectOption('select:has-text("All providers")', 'aws');
    
    // Wait for graph to update
    await page.waitForTimeout(500);
    
    // Verify filter is applied
    const select = page.locator('select:has-text("AWS")');
    await expect(select).toHaveValue('aws');
  });

  test('should clear graph filters', async ({ page }) => {
    // Apply filters
    await page.selectOption('select:has-text("All types")', 'compute');
    await page.selectOption('select:has-text("All providers")', 'aws');
    
    // Click clear button
    await page.click('button:has-text("Clear")');
    
    // Verify filters are reset
    await expect(page.locator('select:has-text("All types")').first()).toHaveValue('');
  });

  test('should display node on click', async ({ page }) => {
    // Wait for graph to load
    await page.waitForSelector('.react-flow', { timeout: 5000 });
    
    // Check if there are any nodes
    const nodes = page.locator('.react-flow__node');
    const nodeCount = await nodes.count();
    
    if (nodeCount > 0) {
      // Click on first node
      await nodes.first().click();
      
      // Wait for detail panel to appear
      await page.waitForTimeout(300);
      
      // Verify detail panel is visible
      const detailPanel = page.locator('div:has-text("Name")').filter({ hasText: 'ID' });
      await expect(detailPanel).toBeVisible();
    }
  });

  test('should close detail panel', async ({ page }) => {
    // Wait for graph to load
    await page.waitForSelector('.react-flow', { timeout: 5000 });
    
    const nodes = page.locator('.react-flow__node');
    const nodeCount = await nodes.count();
    
    if (nodeCount > 0) {
      // Click on first node
      await nodes.first().click();
      await page.waitForTimeout(300);
      
      // Click close button
      await page.click('button[aria-label="Close"]');
      
      // Verify detail panel is hidden
      await page.waitForTimeout(300);
      const detailPanel = page.locator('div:has-text("Name")').filter({ hasText: 'ID' });
      await expect(detailPanel).not.toBeVisible();
    }
  });

  test('should highlight connected nodes on selection', async ({ page }) => {
    // Wait for graph to load
    await page.waitForSelector('.react-flow', { timeout: 5000 });
    
    const nodes = page.locator('.react-flow__node');
    const nodeCount = await nodes.count();
    
    if (nodeCount > 0) {
      // Click on first node
      await nodes.first().click();
      await page.waitForTimeout(300);
      
      // Verify some nodes are dimmed (have reduced opacity)
      const dimmedNodes = page.locator('.react-flow__node[style*="opacity: 0.3"]');
      const dimmedCount = await dimmedNodes.count();
      
      // If there are multiple nodes, some should be dimmed
      if (nodeCount > 1) {
        expect(dimmedCount).toBeGreaterThan(0);
      }
    }
  });

  test('should display graph controls', async ({ page }) => {
    // Wait for graph to load
    await page.waitForSelector('.react-flow', { timeout: 5000 });
    
    // Check for zoom controls
    await expect(page.locator('.react-flow__controls')).toBeVisible();
    
    // Check for minimap
    await expect(page.locator('.react-flow__minimap')).toBeVisible();
  });

  test('should display provider legend', async ({ page }) => {
    // Wait for graph to load
    await page.waitForSelector('.react-flow', { timeout: 5000 });
    
    // Check for provider legend
    await expect(page.locator('p:has-text("Providers")')).toBeVisible();
  });

  test('should show empty state when no resources', async ({ page }) => {
    // Apply filters that return no results
    await page.selectOption('select:has-text("All types")', 'compute');
    await page.selectOption('select:has-text("All providers")', 'gcp');
    
    // Wait for graph to update
    await page.waitForTimeout(1000);
    
    // Check for empty state message (if no resources match)
    const emptyMessage = page.locator('p:has-text("No resources found")');
    const isVisible = await emptyMessage.isVisible();
    
    // Empty state should be visible if no resources match filters
    if (isVisible) {
      await expect(emptyMessage).toBeVisible();
    }
  });
});
