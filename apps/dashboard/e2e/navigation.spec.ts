import { test, expect } from '@playwright/test';

test.describe('Dashboard Navigation', () => {
  test('should navigate to overview page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CIG Dashboard/);
    await expect(page.locator('h1')).toContainText('Overview');
  });

  test('should navigate to resources page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/resources"]');
    await expect(page).toHaveURL('/resources');
    await expect(page.locator('h1')).toContainText('Resources');
  });

  test('should navigate to graph page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/graph"]');
    await expect(page).toHaveURL('/graph');
    await expect(page.locator('h1')).toContainText('Graph');
  });

  test('should navigate to costs page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/costs"]');
    await expect(page).toHaveURL('/costs');
  });

  test('should navigate to security page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/security"]');
    await expect(page).toHaveURL('/security');
  });

  test('should toggle dark mode', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    
    // Check initial state (light mode)
    await expect(html).not.toHaveClass(/dark/);
    
    // Toggle to dark mode
    await page.click('button[aria-label="Toggle dark mode"]');
    await expect(html).toHaveClass(/dark/);
    
    // Toggle back to light mode
    await page.click('button[aria-label="Toggle dark mode"]');
    await expect(html).not.toHaveClass(/dark/);
  });
});
