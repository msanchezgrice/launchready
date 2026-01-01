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

  if (!browserlessApiKey) {
    return {
      html: '',
      title: '',
      metaTags: {},
      scripts: [],
      loaded: false,
      error: 'Browserless API key not configured'
    };
  }

  let browser;

  try {
    // Connect to Browserless WebSocket endpoint
    const browserlessUrl = `wss://chrome.browserless.io?token=${browserlessApiKey}`;

    browser = await chromium.connect(browserlessUrl);

    const context = await browser.newContext({
      userAgent: 'LaunchReady Scanner Bot/1.0'
    });

    const page = await context.newPage();

    // Set timeout and navigate
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 10000 // 10 second timeout
    });

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

    await browser.close();

    return {
      ...pageData,
      loaded: true
    };

  } catch (error) {
    if (browser) {
      await browser.close().catch(() => {
        // Ignore close errors if already disconnected
      });
    }

    return {
      html: '',
      title: '',
      metaTags: {},
      scripts: [],
      loaded: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
