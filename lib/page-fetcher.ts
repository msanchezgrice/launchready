/**
 * Page Fetching Utility using Browserless
 * Fetches and parses web pages for scanning on Vercel serverless
 */

import { chromium, Browser } from 'playwright-core';

export interface PageData {
  html: string;
  title: string;
  metaTags: Record<string, string>;
  scripts: string[];
  loaded: boolean;
  error?: string;
}

// Connection timeout for Browserless (20 seconds)
const CONNECTION_TIMEOUT = 20000;
// Page navigation timeout (15 seconds)
const PAGE_TIMEOUT = 15000;

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
    return {
      html: '',
      title: '',
      metaTags: {},
      scripts: [],
      loaded: false,
      error: 'Browserless API key not configured'
    };
  }

  let browser: Browser | null = null;

  try {
    // Connect to Browserless WebSocket endpoint with timeout
    const browserlessUrl = `wss://chrome.browserless.io?token=${browserlessApiKey}`;
    console.log('[PageFetcher] Connecting to Browserless WebSocket...');

    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Browserless connection timeout (${CONNECTION_TIMEOUT/1000}s)`)), CONNECTION_TIMEOUT)
    );

    // Race between connection and timeout
    browser = await Promise.race([
      chromium.connect(browserlessUrl),
      timeoutPromise
    ]);

    console.log('[PageFetcher] Connected! Creating browser context...');

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (compatible; LaunchReady/1.0; +https://launchready.me)',
      viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    console.log('[PageFetcher] Navigating to page...');
    
    // Navigate with timeout
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: PAGE_TIMEOUT
    });

    console.log('[PageFetcher] Page loaded, extracting data...');

    // Extract data from page
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

      // Also get inline scripts for analytics detection
      document.querySelectorAll('script:not([src])').forEach((script) => {
        if (script.textContent && script.textContent.length > 0) {
          scripts.push(script.textContent.substring(0, 500)); // First 500 chars
        }
      });

      return {
        html: document.documentElement.outerHTML,
        title: document.title,
        metaTags,
        scripts
      };
    });

    console.log('[PageFetcher] Data extracted successfully');
    console.log(`[PageFetcher] Title: ${pageData.title}`);
    console.log(`[PageFetcher] Meta tags: ${Object.keys(pageData.metaTags).length}`);
    console.log(`[PageFetcher] Scripts: ${pageData.scripts.length}`);

    // Close browser
    await browser.close();
    browser = null;

    console.log('[PageFetcher] Success! Returning page data');
    return {
      ...pageData,
      loaded: true
    };

  } catch (error) {
    console.error('[PageFetcher] ERROR:', error);
    
    // Try to close browser if it's open
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Ignore close errors
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PageFetcher] Returning error state:', errorMessage);
    
    // Return error state instead of throwing - allows partial scanning
    return {
      html: '',
      title: '',
      metaTags: {},
      scripts: [],
      loaded: false,
      error: errorMessage
    };
  }
}
