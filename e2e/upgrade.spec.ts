/**
 * E2E tests for upgrade flow
 * 
 * To run: npx playwright test e2e/upgrade.spec.ts
 * 
 * Prerequisites:
 * - Local dev server running (npm run dev)
 * - Test user credentials set up
 */

import { test, expect } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

test.describe('Pricing Page', () => {
  test('should display all pricing tiers', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Check page loaded
    await expect(page.locator('h1')).toContainText('Pricing');

    // Verify all tiers are displayed
    await expect(page.locator('text=Free')).toBeVisible();
    await expect(page.locator('text=Pro')).toBeVisible();
    await expect(page.locator('text=Pro Plus')).toBeVisible();
    await expect(page.locator('text=Enterprise')).toBeVisible();

    // Verify prices
    await expect(page.locator('text=$0')).toBeVisible();
    await expect(page.locator('text=$19')).toBeVisible();
    await expect(page.locator('text=$39')).toBeVisible();
    await expect(page.locator('text=$99')).toBeVisible();
  });

  test('should highlight Pro tier as most popular', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Check for "Most Popular" badge
    await expect(page.locator('text=Most Popular')).toBeVisible();
  });

  test('should display feature comparison', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Check key features are listed
    await expect(page.locator('text=1 project')).toBeVisible();
    await expect(page.locator('text=6 projects')).toBeVisible();
    await expect(page.locator('text=15 projects')).toBeVisible();
    await expect(page.locator('text=Unlimited projects')).toBeVisible();
  });

  test('should have FAQ section', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Scroll to FAQ
    await page.locator('text=Frequently Asked Questions').scrollIntoViewIfNeeded();

    // Check FAQ questions
    await expect(page.locator('text=Can I cancel anytime?')).toBeVisible();
    await expect(page.locator('text=What payment methods do you accept?')).toBeVisible();
  });
});

test.describe('Upgrade Flow', () => {
  test('should redirect to sign-in when upgrading as anonymous user', async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);

    // Click upgrade button for Pro tier
    await page.click('button:has-text("Upgrade to Pro")');

    // Should redirect to sign-up page
    await expect(page).toHaveURL(/sign-up|sign-in/);
  });

  // Note: These tests require authentication
  test.describe('Authenticated User', () => {
    // In a real test, you'd set up authentication here
    // For Clerk, you might use test tokens or mock auth

    test.skip('should redirect to Stripe checkout when upgrading', async ({ page }) => {
      // Login first (implementation depends on your auth setup)
      // await loginAsUser(page, 'test@example.com', 'password');

      await page.goto(`${BASE_URL}/pricing`);

      // Click upgrade button
      await page.click('button:has-text("Upgrade to Pro")');

      // Should redirect to Stripe checkout (test mode)
      await expect(page).toHaveURL(/checkout.stripe.com/);
    });

    test.skip('should show success message after successful upgrade', async ({ page }) => {
      // Simulate successful checkout by navigating to success URL
      await page.goto(`${BASE_URL}/dashboard?checkout=success&plan=pro`);

      // Check for success message
      await expect(page.locator('text=Welcome to Pro')).toBeVisible();
    });

    test.skip('should show plan badge in dashboard after upgrade', async ({ page }) => {
      // Login as pro user
      // await loginAsProUser(page);

      await page.goto(`${BASE_URL}/dashboard`);

      // Check for Pro badge
      await expect(page.locator('text=Pro').first()).toBeVisible();
    });
  });
});

test.describe('Dashboard Plan Features', () => {
  test.skip('free user should see upgrade prompts', async ({ page }) => {
    // Login as free user
    // await loginAsFreeUser(page);

    await page.goto(`${BASE_URL}/dashboard`);

    // Should see upgrade banner
    await expect(page.locator('text=Unlock More with Pro')).toBeVisible();
    await expect(page.locator('text=Upgrade to Pro - $19/mo')).toBeVisible();
  });

  test.skip('free user should be blocked from adding second project', async ({ page }) => {
    // Login as free user with 1 project
    // await loginAsFreeUser(page);

    await page.goto(`${BASE_URL}/dashboard`);

    // Click add project
    await page.click('button:has-text("Add Project")');

    // Fill form
    await page.fill('input[placeholder="My Awesome Project"]', 'Second Project');
    await page.fill('input[placeholder="https://example.com"]', 'https://second.example.com');

    // Submit
    await page.click('button:has-text("Add & Scan")');

    // Should see error about project limit
    await expect(page.locator('text=Project limit reached')).toBeVisible();
  });

  test.skip('pro user should be able to add up to 6 projects', async ({ page }) => {
    // Login as pro user
    // await loginAsProUser(page);

    await page.goto(`${BASE_URL}/dashboard`);

    // Should show higher project limit
    await expect(page.locator('text=/\\d+\\/6 projects/')).toBeVisible();
  });
});

test.describe('Stripe Webhook Integration', () => {
  test.skip('should update user plan after successful payment', async ({ page }) => {
    // This test would require mocking Stripe webhooks
    // In a real E2E test, you'd:
    // 1. Complete a test checkout
    // 2. Trigger webhook with Stripe CLI
    // 3. Verify database update
  });

  test.skip('should downgrade user after subscription cancellation', async ({ page }) => {
    // Similar to above, requires webhook mocking
  });
});

// Helper functions (would be implemented based on your auth setup)
async function loginAsUser(page: any, email: string, password: string) {
  await page.goto(`${BASE_URL}/sign-in`);
  await page.fill('input[name="identifier"]', email);
  await page.click('button:has-text("Continue")');
  await page.fill('input[name="password"]', password);
  await page.click('button:has-text("Continue")');
  await page.waitForURL('**/dashboard');
}
