/**
 * Page Fetching Utility using Browserless
 * Fetches and parses web pages for scanning on Vercel serverless
 */

import { chromium } from 'playwright-core';

export interface PageData {
  html: string;
  title: string;
  metaTags: Record<string, string>;
  scripts: string[];
  loaded: boolean;
  error?: string;
}

/**
 * Fetch a web page and extract relevant data for scanning
 * Uses Browserless API for serverless compatibility
 */
export async function fetchPage(url: string): Promise<PageData> {
  const browserlessApiKey = process.env.BROWSERLESS_API_KEY;

  console.log('[PageFetcher] Starting fetch for:', url);
  console.log('[PageFetcher] API key exists:', !!browserlessApiKey);

  if (!browserlessApiKey) {
    console.error('[PageFetcher] ERROR: Browserless API key not configured');
    throw new Error('Browserless API key not configured');
  }

  let browser;

  try {
    // Connect to Browserless WebSocket endpoint with timeout
    const browserlessUrl = `wss://chrome.browserless.io?token=${browserlessApiKey}`;
    console.log('[PageFetcher] Connecting to Browserless WebSocket...');

    // Wrap connection in a timeout
    browser = await Promise.race([
      chromium.connect(browserlessUrl),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Browserless connection timeout (30s)')), 30000)
      )
    ]) as any;

    console.log('[PageFetcher] Connected! Creating browser context...');

    const context = await browser.newContext({
      userAgent: 'LaunchReady Scanner Bot/1.0'
    });

    const page = await context.newPage();

    console.log('[PageFetcher] Navigating to page...');
    // Set timeout and navigate
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000 // 15 second timeout
    });

    console.log('[PageFetcher] Page loaded, extracting data...');

    // Extract data
    const pageData = await page.evaluate(() => {
      // Get all meta tags
      const metaTags: Record<string, string> = {};
      document.querySelectorAll('meta').forEach((meta) => {
        const name = meta.getAttribute('name') || meta.getAttribute('property') || '';
        const content = meta.getAttribute('content') || '';
        if (name && content) {
          metaTags[name] = content;
        }
      });

      // Get all script sources
      const scripts: string[] = [];
      document.querySelectorAll('script[src]').forEach((script) => {
        const src = script.getAttribute('src');
        if (src) scripts.push(src);
      });

      return {
        html: document.documentElement.outerHTML,
        title: document.title,
        metaTags,
        scripts
      };
    });

    console.log('[PageFetcher] Data extracted, closing browser...');
    await browser.close();

    console.log('[PageFetcher] Success! Returning page data');
    return {
      ...pageData,
      loaded: true
    };

  } catch (error) {
    console.error('[PageFetcher] ERROR:', error);
    if (browser) {
      await browser.close().catch(() => {
        // Ignore close errors if already disconnected
      });
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PageFetcher] Throwing error:', errorMessage);
    throw new Error(`Failed to fetch page: ${errorMessage}`);
  }
}
