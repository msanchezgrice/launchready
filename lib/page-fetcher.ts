/**
 * Page Fetching Utility - Hybrid approach
 * 1. First try simple HTTP fetch (fast, works for most static sites)
 * 2. Fall back to Browserless for JS-heavy sites (if needed)
 */

import { chromium, Browser } from 'playwright-core';

export interface PageData {
  html: string;
  title: string;
  metaTags: Record<string, string>;
  scripts: string[];
  loaded: boolean;
  error?: string;
  fetchMethod?: 'http' | 'browserless';
}

/**
 * Parse HTML and extract meta tags, title, and scripts
 */
function parseHtml(html: string): { title: string; metaTags: Record<string, string>; scripts: string[] } {
  const metaTags: Record<string, string> = {};
  const scripts: string[] = [];
  
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  // Extract meta tags (handles both name="x" content="y" and property="x" content="y")
  const metaRegex = /<meta[^>]+(?:name|property)=["']([^"']+)["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']([^"']+)["']/gi;
  let metaMatch;
  while ((metaMatch = metaRegex.exec(html)) !== null) {
    const name = metaMatch[1] || metaMatch[4];
    const content = metaMatch[2] || metaMatch[3];
    if (name && content !== undefined) {
      metaTags[name] = content;
    }
  }
  
  // Extract script sources
  const scriptRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    scripts.push(scriptMatch[1]);
  }
  
  // Also extract inline script content (for analytics detection)
  const inlineScriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
  let inlineMatch;
  while ((inlineMatch = inlineScriptRegex.exec(html)) !== null) {
    const content = inlineMatch[1].trim();
    if (content.length > 0) {
      scripts.push(content.substring(0, 500)); // First 500 chars
    }
  }
  
  return { title, metaTags, scripts };
}

/**
 * Simple HTTP fetch - fast and works for most sites
 */
async function fetchWithHttp(url: string): Promise<PageData> {
  console.log('[PageFetcher:HTTP] Fetching:', url);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LaunchReady/1.0; +https://launchready.me)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const parsed = parseHtml(html);
    
    console.log('[PageFetcher:HTTP] Success!');
    console.log(`[PageFetcher:HTTP] Title: "${parsed.title?.substring(0, 50)}..."`);
    console.log(`[PageFetcher:HTTP] Meta tags: ${Object.keys(parsed.metaTags).length}`);
    console.log(`[PageFetcher:HTTP] Scripts: ${parsed.scripts.length}`);
    
    return {
      html,
      ...parsed,
      loaded: true,
      fetchMethod: 'http',
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Browserless fetch - for JS-heavy sites or when HTTP fails
 */
async function fetchWithBrowserless(url: string): Promise<PageData> {
  const browserlessApiKey = process.env.BROWSERLESS_API_KEY;
  
  console.log('[PageFetcher:Browserless] Starting fetch for:', url);
  
  if (!browserlessApiKey) {
    throw new Error('Browserless API key not configured');
  }
  
  let browser: Browser | null = null;
  
  try {
    const browserlessUrl = `wss://chrome.browserless.io?token=${browserlessApiKey}`;
    console.log('[PageFetcher:Browserless] Connecting...');
    
    // 45 second timeout for connection (Browserless can be slow)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Browserless connection timeout (45s)')), 45000)
    );
    
    browser = await Promise.race([
      chromium.connect(browserlessUrl),
      timeoutPromise
    ]);
    
    console.log('[PageFetcher:Browserless] Connected!');
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (compatible; LaunchReady/1.0; +https://launchready.me)',
      viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000 // 30s page load timeout
    });
    
    const pageData = await page.evaluate(() => {
      const metaTags: Record<string, string> = {};
      document.querySelectorAll('meta').forEach((meta) => {
        const name = meta.getAttribute('name') || meta.getAttribute('property') || '';
        const content = meta.getAttribute('content') || '';
        if (name && content) metaTags[name] = content;
      });
      
      const scripts: string[] = [];
      document.querySelectorAll('script[src]').forEach((script) => {
        const src = script.getAttribute('src');
        if (src) scripts.push(src);
      });
      
      // Also get inline scripts for analytics detection
      document.querySelectorAll('script:not([src])').forEach((script) => {
        if (script.textContent && script.textContent.length > 0) {
          scripts.push(script.textContent.substring(0, 500));
        }
      });
      
      return {
        html: document.documentElement.outerHTML,
        title: document.title,
        metaTags,
        scripts
      };
    });
    
    await browser.close();
    browser = null;
    
    console.log('[PageFetcher:Browserless] Success!');
    console.log(`[PageFetcher:Browserless] Title: "${pageData.title?.substring(0, 50)}..."`);
    
    return { ...pageData, loaded: true, fetchMethod: 'browserless' };
    
  } catch (error) {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    throw error;
  }
}

/**
 * Main fetch function - tries HTTP first, falls back to Browserless
 */
export async function fetchPage(url: string): Promise<PageData> {
  console.log('[PageFetcher] Starting fetch for:', url);
  
  // First, try simple HTTP fetch (fast, works for most sites)
  try {
    const result = await fetchWithHttp(url);
    
    // Check if we got meaningful content
    if (result.title || Object.keys(result.metaTags).length > 0) {
      return result;
    }
    
    console.log('[PageFetcher] HTTP returned empty content, trying Browserless...');
  } catch (httpError) {
    console.log('[PageFetcher] HTTP fetch failed:', httpError instanceof Error ? httpError.message : 'Unknown');
  }
  
  // Fall back to Browserless if HTTP fails or returns empty content
  console.log('[PageFetcher] Falling back to Browserless...');
  
  try {
    return await fetchWithBrowserless(url);
  } catch (browserlessError) {
    console.error('[PageFetcher] Browserless also failed:', browserlessError);
    
    // Return a partial result instead of failing completely
    return {
      html: '',
      title: '',
      metaTags: {},
      scripts: [],
      loaded: false,
      error: `Could not fetch page: ${browserlessError instanceof Error ? browserlessError.message : 'Unknown error'}`,
    };
  }
}
