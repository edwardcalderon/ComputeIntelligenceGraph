import { test, expect } from '@playwright/test';

test.describe('Resources Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/resources');
  });

  test('should display resources list', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Resources');
    await expect(page.locator('table')).toBeVisible();
  });

  test('should filter resources by type', async ({ page }) => {
    // Select compute type
    await page.selectOption('select:has-text("All types")', 'compute');
    
    // Wait for URL to update
    await expect(page).toHaveURL(/type=compute/);
    
    // Verify filter is applied
    const select = page.locator('select:has-text("Compute")');
    await expect(select).toHaveValue('compute');
  });

  test('should filter resources by provider', async ({ page }) => {
    // Select AWS provider
    await page.selectOption('select:has-text("All providers")', 'aws');
    
    // Wait for URL to update
    await expect(page).toHaveURL(/provider=aws/);
    
    // Verify filter is applied
    const select = page.locator('select:has-text("AWS")');
    await expect(select).toHaveValue('aws');
  });

  test('should filter resources by state', async ({ page }) => {
    // Select active state
    await page.selectOption('select:has-text("All states")', 'active');
    
    // Wait for URL to update
    await expect(page).toHaveURL(/state=active/);
    
    // Verify filter is applied
    const select = page.locator('select:has-text("Active")');
    await expect(select).toHaveValue('active');
  });

  test('should search resources by name', async ({ page }) => {
    const searchInput = page.locator('input[type="search"]');
    
    // Type search query
    await searchInput.fill('web-server');
    
    // Wait for URL to update
    await expect(page).toHaveURL(/search=web-server/);
  });

  test('should combine multiple filters', async ({ page }) => {
    // Apply type filter
    await page.selectOption('select:has-text("All types")', 'compute');
    
    // Apply provider filter
    await page.selectOption('select:has-text("All providers")', 'aws');
    
    // Verify both filters in URL
    await expect(page).toHaveURL(/type=compute/);
    await expect(page).toHaveURL(/provider=aws/);
  });

  test('should clear all filters', async ({ page }) => {
    // Apply filters
    await page.selectOption('select:has-text("All types")', 'compute');
    await page.selectOption('select:has-text("All providers")', 'aws');
    
    // Click clear filters button
    await page.click('button:has-text("Clear filters")');
    
    // Verify URL is reset
    await expect(page).toHaveURL('/resources');
  });

  test('should paginate through resources', async ({ page }) => {
    // Wait for resources to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });
    
    // Check if pagination exists
    const nextButton = page.locator('button:has-text("Next")');
    
    if (await nextButton.isEnabled()) {
      // Click next page
      await nextButton.click();
      
      // Verify page parameter in URL
      await expect(page).toHaveURL(/page=2/);
      
      // Click previous page
      await page.click('button:has-text("Previous")');
      await expect(page).toHaveURL(/page=1/);
    }
  });

  test('should navigate to resource detail page', async ({ page }) => {
    // Wait for resources to load
    await page.waitForSelector('table tbody tr', { timeout: 5000 });
    
    // Click on first resource row
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();
    
    // Verify navigation to detail page
    await expect(page).toHaveURL(/\/resources\/.+/);
  });
});
