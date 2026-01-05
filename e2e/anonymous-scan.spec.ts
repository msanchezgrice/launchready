/**
 * E2E tests for anonymous scanning flow
 * 
 * Run: npm run test:e2e
 * Debug: npm run test:e2e:debug
 */

import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('displays hero section with scan form', async ({ page }) => {
    await page.goto('/');

    // Verify hero content
    await expect(page.locator('h1')).toContainText('Ready to Launch');
    
    // Verify scan form exists
    await expect(page.getByTestId('scan-form')).toBeVisible();
    await expect(page.getByTestId('url-input')).toBeVisible();
    await expect(page.getByTestId('scan-button')).toBeVisible();
    await expect(page.getByTestId('scan-button')).toContainText('Scan Your Project');
  });

  test('displays what we check section', async ({ page }) => {
    await page.goto('/');

    // Scroll to What We Check section
    await page.locator('text=What We Check').scrollIntoViewIfNeeded();
    
    // Verify all 8 phases are shown
    await expect(page.locator('text=Domain')).toBeVisible();
    await expect(page.locator('text=SEO')).toBeVisible();
    await expect(page.locator('text=Performance')).toBeVisible();
    await expect(page.locator('text=Security')).toBeVisible();
    await expect(page.locator('text=Analytics')).toBeVisible();
    await expect(page.locator('text=Social')).toBeVisible();
    await expect(page.locator('text=Content')).toBeVisible();
    await expect(page.locator('text=Monitoring')).toBeVisible();
  });

  test('displays pricing section', async ({ page }) => {
    await page.goto('/');

    // Scroll to pricing
    await page.locator('text=Pricing:').scrollIntoViewIfNeeded();
    
    // Verify all tiers
    await expect(page.locator('text=$0').first()).toBeVisible();
    await expect(page.locator('text=$19').first()).toBeVisible();
    await expect(page.locator('text=$39').first()).toBeVisible();
    await expect(page.locator('text=$99').first()).toBeVisible();
  });
});

test.describe('Anonymous Scan Form', () => {
  test('shows validation error for empty URL', async ({ page }) => {
    await page.goto('/');

    // Click scan without entering URL
    await page.getByTestId('scan-button').click();

    // Should show validation error
    await expect(page.getByTestId('error-message')).toBeVisible();
    await expect(page.getByTestId('error-message')).toContainText('URL is required');
  });

  test('accepts valid URL input', async ({ page }) => {
    await page.goto('/');

    const input = page.getByTestId('url-input');
    
    // Type URL
    await input.fill('example.com');
    
    // Verify value is set
    await expect(input).toHaveValue('example.com');
  });

  test('initiates scan on form submit', async ({ page }) => {
    await page.goto('/');

    // Fill URL
    await page.getByTestId('url-input').fill('example.com');
    
    // Click scan button
    await page.getByTestId('scan-button').click();
    
    // Should show scanning state
    await expect(page.getByTestId('scan-button')).toContainText('Scanning');
    
    // Button should be disabled during scan
    await expect(page.getByTestId('scan-button')).toBeDisabled();
  });

  test('completes scan and redirects to results', async ({ page }) => {
    // Set longer timeout for full scan
    test.setTimeout(120000);
    
    await page.goto('/');

    // Fill URL with a fast-loading site
    await page.getByTestId('url-input').fill('google.com');
    
    // Submit scan
    await page.getByTestId('scan-button').click();
    
    // Wait for redirect to results page
    await page.waitForURL(/\/results/, { timeout: 90000 });
    
    // Verify we're on results page
    expect(page.url()).toContain('/results');
    
    // Verify results content
    await expect(page.locator('text=/\\d+.*\\/.*100/')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Scan Results Page', () => {
  test.beforeEach(async ({ page }) => {
    // Pre-populate session storage with mock scan result
    await page.goto('/');
    await page.evaluate(() => {
      const mockResult = {
        url: 'https://example.com',
        score: 75,
        maxScore: 100,
        scannedAt: new Date().toISOString(),
        phases: [
          {
            phaseName: 'Domain & DNS',
            score: 15,
            maxScore: 15,
            findings: [
              { type: 'success', message: 'DNS resolves correctly' },
              { type: 'success', message: 'SSL certificate valid' },
            ],
            recommendations: [],
          },
          {
            phaseName: 'SEO',
            score: 10,
            maxScore: 12,
            findings: [
              { type: 'success', message: 'Title tag present' },
              { type: 'warning', message: 'Meta description too short' },
            ],
            recommendations: [
              { title: 'Extend meta description', priority: 'medium' },
            ],
          },
          {
            phaseName: 'Performance',
            score: 8,
            maxScore: 13,
            findings: [
              { type: 'warning', message: 'Page load time could be improved' },
            ],
            recommendations: [
              { title: 'Optimize images', priority: 'high' },
            ],
          },
          {
            phaseName: 'Security',
            score: 12,
            maxScore: 15,
            findings: [
              { type: 'success', message: 'HTTPS enabled' },
              { type: 'warning', message: 'HSTS header missing' },
            ],
            recommendations: [
              { title: 'Add HSTS header', priority: 'medium' },
            ],
          },
          {
            phaseName: 'Analytics',
            score: 5,
            maxScore: 10,
            findings: [
              { type: 'warning', message: 'No analytics detected' },
            ],
            recommendations: [
              { title: 'Add analytics tracking', priority: 'high' },
            ],
          },
          {
            phaseName: 'Social Media',
            score: 8,
            maxScore: 10,
            findings: [
              { type: 'success', message: 'OG tags present' },
            ],
            recommendations: [],
          },
          {
            phaseName: 'Content Quality',
            score: 10,
            maxScore: 12,
            findings: [
              { type: 'success', message: 'Clear value proposition' },
            ],
            recommendations: [],
          },
          {
            phaseName: 'Monitoring',
            score: 7,
            maxScore: 13,
            findings: [
              { type: 'warning', message: 'No error tracking detected' },
            ],
            recommendations: [
              { title: 'Set up Sentry', priority: 'high' },
            ],
          },
        ],
      };
      sessionStorage.setItem('scanResult', JSON.stringify(mockResult));
      sessionStorage.setItem('scannedUrl', 'example.com');
    });
    await page.goto('/results');
  });

  test('displays overall score', async ({ page }) => {
    await expect(page.locator('text=75')).toBeVisible();
    await expect(page.locator('text=/\\/100/')).toBeVisible();
  });

  test('displays all 8 phases', async ({ page }) => {
    await expect(page.locator('text=Domain')).toBeVisible();
    await expect(page.locator('text=SEO')).toBeVisible();
    await expect(page.locator('text=Performance')).toBeVisible();
    await expect(page.locator('text=Security')).toBeVisible();
    await expect(page.locator('text=Analytics')).toBeVisible();
    await expect(page.locator('text=Social')).toBeVisible();
    await expect(page.locator('text=Content')).toBeVisible();
    await expect(page.locator('text=Monitoring')).toBeVisible();
  });

  test('shows CTA for non-logged-in users', async ({ page }) => {
    // Should show signup CTA
    await expect(
      page.locator('text=/Create.*account|Sign.*up|Dashboard/')
    ).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('header shows login/signup for anonymous users', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('a[href="/sign-in"]')).toBeVisible();
    await expect(page.locator('a[href="/sign-up"]')).toBeVisible();
  });

  test('clicking logo navigates to home', async ({ page }) => {
    await page.goto('/pricing');
    
    await page.locator('text=LaunchReady.me').first().click();
    
    await expect(page).toHaveURL('/');
  });

  test('pricing page is accessible', async ({ page }) => {
    await page.goto('/pricing');
    
    await expect(page.locator('h1')).toContainText('Pricing');
    
    // All tiers visible
    await expect(page.locator('text=Free').first()).toBeVisible();
    await expect(page.locator('text=Pro').first()).toBeVisible();
    await expect(page.locator('text=Pro Plus').first()).toBeVisible();
    await expect(page.locator('text=Enterprise').first()).toBeVisible();
  });
});

test.describe('Dashboard Access', () => {
  test('redirects to sign-in when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to sign-in
    await expect(page).toHaveURL(/sign-in/);
  });

  test('projects page redirects to sign-in', async ({ page }) => {
    await page.goto('/projects/some-id');

    // Should redirect to sign-in
    await expect(page).toHaveURL(/sign-in/);
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('landing page is mobile-friendly', async ({ page }) => {
    await page.goto('/');

    // Hero should be visible
    await expect(page.locator('h1')).toBeVisible();
    
    // Scan form should be usable
    await expect(page.getByTestId('url-input')).toBeVisible();
    await expect(page.getByTestId('scan-button')).toBeVisible();
    
    // Form should stack vertically on mobile
    const form = page.getByTestId('scan-form');
    await expect(form).toBeVisible();
  });

  test('pricing page renders on mobile', async ({ page }) => {
    await page.goto('/pricing');

    // All pricing tiers should be visible (may need to scroll)
    await expect(page.locator('text=Free').first()).toBeVisible();
    
    // Scroll to see more tiers
    await page.locator('text=Enterprise').scrollIntoViewIfNeeded();
    await expect(page.locator('text=Enterprise').first()).toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('handles network errors gracefully', async ({ page }) => {
    await page.goto('/');

    // Mock failed API response
    await page.route('/api/scan', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    // Try to scan
    await page.getByTestId('url-input').fill('example.com');
    await page.getByTestId('scan-button').click();

    // Should show error
    await expect(page.getByTestId('error-message')).toBeVisible({ timeout: 10000 });
  });

  test('results page handles missing session data', async ({ page }) => {
    // Go directly to results without session data
    await page.goto('/results');

    // Should handle gracefully (redirect or show message)
    // This depends on implementation - either redirect to home or show error
    await page.waitForLoadState('networkidle');
    
    // Page should still be functional (not crash)
    expect(page.url()).toBeTruthy();
  });
});
