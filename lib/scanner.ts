/**
 * LaunchReady Scanning Engine
 * Performs 8-phase readiness assessment on any URL
 */

import { fetchPage, type PageData } from './page-fetcher';

// Module-level cache to avoid redundant page fetches during a single scan
const pageCache = new Map<string, PageData>();

export interface ScanPhaseResult {
  phaseName: string;
  score: number;
  maxScore: number;
  findings: Finding[];
  recommendations: Recommendation[];
}

export interface Finding {
  type: 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionable: string;
}

export interface ScanResult {
  url: string;
  score: number;
  maxScore: number;
  phases: ScanPhaseResult[];
  scannedAt: Date;
  executiveSummary?: string;
  topPriorities?: string[];
}

/**
 * Helper function for OpenAI API calls
 */
async function callOpenAI(prompt: string, systemPrompt: string, maxTokens: number = 500): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.log('[OpenAI] No API key configured');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: maxTokens
      }),
      signal: AbortSignal.timeout(15000) // 15s timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OpenAI] API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('[OpenAI] Request failed:', error);
    return null;
  }
}

/**
 * Phase 1: Domain & DNS Configuration
 */
export async function checkDomain(url: string): Promise<ScanPhaseResult> {
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];
  let score = 0;
  const maxScore = 100;

  try {
    // Extract domain from URL
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Check HTTPS
    if (urlObj.protocol === 'https:') {
      score += 30;
      findings.push({
        type: 'success',
        message: 'Site uses HTTPS',
        details: 'SSL/TLS encryption is active'
      });
    } else {
      findings.push({
        type: 'error',
        message: 'Site does not use HTTPS',
        details: 'Unencrypted connection is insecure'
      });
      recommendations.push({
        priority: 'high',
        title: 'Enable HTTPS',
        description: 'Secure your site with SSL/TLS certificate',
        actionable: 'Use Let\'s Encrypt or your hosting provider\'s SSL'
      });
    }

    // Check if it's a real domain (not localhost, IP, etc.)
    if (!domain.includes('localhost') && !domain.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      score += 20;
      findings.push({
        type: 'success',
        message: 'Valid domain name',
        details: `Domain: ${domain}`
      });
    }

    // Check for www redirect
    if (domain.startsWith('www.')) {
      score += 15;
      findings.push({
        type: 'success',
        message: 'WWW subdomain configured'
      });
    } else {
      score += 10;
      recommendations.push({
        priority: 'medium',
        title: 'Configure WWW redirect',
        description: 'Ensure both www and non-www versions work',
        actionable: 'Set up DNS records and redirects for both variants'
      });
    }

    // Basic accessibility check (can we reach it?)
    score += 35; // Assume reachable if we got here

  } catch (error) {
    findings.push({
      type: 'error',
      message: 'Invalid URL format',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  return {
    phaseName: 'Domain & DNS',
    score,
    maxScore,
    findings,
    recommendations
  };
}

/**
 * Phase 2: SEO Fundamentals
 */
export async function checkSEO(url: string): Promise<ScanPhaseResult> {
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];
  let score = 0;
  const maxScore = 100;

  // Get cached page data (fetched once in scanProject)
  const pageData = pageCache.get(url) || await fetchPage(url);

  if (!pageData.loaded) {
    findings.push({
      type: 'error',
      message: 'Failed to load page',
      details: pageData.error || 'Could not fetch page for analysis'
    });
    return { phaseName: 'SEO Fundamentals', score, maxScore, findings, recommendations };
  }

  // Check page title
  if (pageData.title && pageData.title.length > 0) {
    score += 25;
    if (pageData.title.length >= 50 && pageData.title.length <= 60) {
      score += 10;
      findings.push({
        type: 'success',
        message: 'Page title is well-optimized',
        details: `Title length: ${pageData.title.length} characters (ideal: 50-60)`
      });
    } else {
      findings.push({
        type: 'warning',
        message: `Page title length is ${pageData.title.length} characters`,
        details: 'Ideal length is 50-60 characters for SEO'
      });
      recommendations.push({
        priority: 'high',
        title: 'Optimize page title length',
        description: 'Page titles should be 50-60 characters for best SEO results',
        actionable: `Current: ${pageData.title.length} chars. ${pageData.title.length > 60 ? 'Shorten' : 'Expand'} to 50-60 chars.`
      });
    }
  } else {
    findings.push({
      type: 'error',
      message: 'Missing page title',
      details: 'Every page should have a unique, descriptive title'
    });
    recommendations.push({
      priority: 'high',
      title: 'Add page title',
      description: 'Page title is critical for SEO and user experience',
      actionable: 'Add a <title> tag with 50-60 character description'
    });
  }

  // Check meta description
  const description = pageData.metaTags['description'] || pageData.metaTags['og:description'];
  if (description && description.length > 0) {
    score += 25;
    if (description.length >= 150 && description.length <= 160) {
      score += 10;
      findings.push({
        type: 'success',
        message: 'Meta description is well-optimized',
        details: `Description length: ${description.length} characters (ideal: 150-160)`
      });
    } else {
      findings.push({
        type: 'warning',
        message: `Meta description length is ${description.length} characters`,
        details: 'Ideal length is 150-160 characters for SEO'
      });
      recommendations.push({
        priority: 'high',
        title: 'Optimize meta description length',
        description: 'Meta descriptions should be 150-160 characters',
        actionable: `Current: ${description.length} chars. ${description.length > 160 ? 'Shorten' : 'Expand'} to 150-160 chars.`
      });
    }
  } else {
    findings.push({
      type: 'error',
      message: 'Missing meta description',
      details: 'Meta description improves click-through rates from search'
    });
    recommendations.push({
      priority: 'high',
      title: 'Add meta description',
      description: 'Write compelling meta description (150-160 chars)',
      actionable: 'Add <meta name="description" content="..."> tag'
    });
  }

  // Check Open Graph tags
  const hasOGTitle = !!pageData.metaTags['og:title'];
  const hasOGDescription = !!pageData.metaTags['og:description'];
  const hasOGImage = !!pageData.metaTags['og:image'];

  if (hasOGTitle && hasOGDescription && hasOGImage) {
    score += 20;
    findings.push({
      type: 'success',
      message: 'Open Graph tags present',
      details: 'Good for social media sharing'
    });
  } else {
    findings.push({
      type: 'warning',
      message: 'Incomplete Open Graph tags',
      details: `Missing: ${[!hasOGTitle && 'og:title', !hasOGDescription && 'og:description', !hasOGImage && 'og:image'].filter(Boolean).join(', ')}`
    });
    recommendations.push({
      priority: 'medium',
      title: 'Add Open Graph tags',
      description: 'Improves how your site appears when shared on social media',
      actionable: 'Add og:title, og:description, and og:image meta tags'
    });
  }

  // Check for keywords (bonus points)
  if (pageData.metaTags['keywords']) {
    score += 10;
    findings.push({
      type: 'success',
      message: 'Meta keywords present',
      details: 'Keywords can help with topic relevance'
    });
  }

  return {
    phaseName: 'SEO Fundamentals',
    score,
    maxScore,
    findings,
    recommendations
  };
}

/**
 * Phase 3: Performance
 * Uses Google PageSpeed Insights API for real performance metrics
 */
export async function checkPerformance(url: string): Promise<ScanPhaseResult> {
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];
  let score = 0;
  const maxScore = 100;

  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;

  if (!apiKey) {
    // Fallback: Basic performance checks without API
    console.log('[Scanner:Performance] No PageSpeed API key, using basic checks');
    
    const pageData = pageCache.get(url);
    if (pageData?.loaded) {
      // Check HTML size
      const htmlSize = pageData.html.length;
      if (htmlSize < 100000) { // < 100KB
        score += 30;
        findings.push({
          type: 'success',
          message: 'HTML size is reasonable',
          details: `${Math.round(htmlSize / 1024)}KB HTML document`
        });
      } else {
        findings.push({
          type: 'warning',
          message: 'Large HTML document',
          details: `${Math.round(htmlSize / 1024)}KB - consider optimizing`
        });
        recommendations.push({
          priority: 'medium',
          title: 'Reduce HTML size',
          description: 'Large HTML documents slow down initial page load',
          actionable: 'Remove unused code, minify HTML, use code splitting'
        });
      }

      // Check number of scripts
      const scriptCount = pageData.scripts.length;
      if (scriptCount <= 10) {
        score += 20;
        findings.push({
          type: 'success',
          message: 'Reasonable number of scripts',
          details: `${scriptCount} scripts detected`
        });
      } else {
        findings.push({
          type: 'warning',
          message: 'Many scripts detected',
          details: `${scriptCount} scripts may impact load time`
        });
        recommendations.push({
          priority: 'high',
          title: 'Reduce JavaScript',
          description: 'Too many scripts slow down page load and interactivity',
          actionable: 'Bundle scripts, remove unused dependencies, use code splitting'
        });
      }

      score += 20; // Base score for loaded page
    }

    // Generic recommendations
    recommendations.push({
      priority: 'high',
      title: 'Optimize images',
      description: 'Compress and serve images in modern formats (WebP, AVIF)',
      actionable: 'Use Next.js Image component for automatic optimization'
    });

    recommendations.push({
      priority: 'medium',
      title: 'Enable caching',
      description: 'Configure proper cache headers for static assets',
      actionable: 'Set up CDN with Vercel or Cloudflare'
    });

    return { phaseName: 'Performance', score: Math.max(score, 40), maxScore, findings, recommendations };
  }

  // Use Google PageSpeed Insights API
  try {
    console.log('[Scanner:Performance] Fetching PageSpeed Insights...');
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&category=performance&strategy=mobile`;
    
    const response = await fetch(apiUrl, { 
      signal: AbortSignal.timeout(30000) // 30s timeout
    });

    if (!response.ok) {
      throw new Error(`PageSpeed API error: ${response.status}`);
    }

    const data = await response.json();
    const lighthouse = data.lighthouseResult;

    if (lighthouse) {
      // Get performance score (0-1, convert to 0-100)
      const perfScore = Math.round((lighthouse.categories?.performance?.score || 0) * 100);
      score = perfScore;

      findings.push({
        type: perfScore >= 90 ? 'success' : perfScore >= 50 ? 'warning' : 'error',
        message: `Performance Score: ${perfScore}/100`,
        details: 'Based on Google Lighthouse mobile audit'
      });

      // Core Web Vitals
      const audits = lighthouse.audits || {};
      
      // LCP - Largest Contentful Paint
      const lcp = audits['largest-contentful-paint'];
      if (lcp) {
        const lcpValue = lcp.numericValue / 1000; // Convert to seconds
        findings.push({
          type: lcpValue <= 2.5 ? 'success' : lcpValue <= 4 ? 'warning' : 'error',
          message: `LCP: ${lcpValue.toFixed(1)}s`,
          details: lcpValue <= 2.5 ? 'Good (≤2.5s)' : lcpValue <= 4 ? 'Needs Improvement (2.5-4s)' : 'Poor (>4s)'
        });
        if (lcpValue > 2.5) {
          recommendations.push({
            priority: 'high',
            title: 'Improve Largest Contentful Paint',
            description: `LCP is ${lcpValue.toFixed(1)}s, should be under 2.5s`,
            actionable: 'Optimize images, reduce server response time, remove render-blocking resources'
          });
        }
      }

      // FID / TBT - Total Blocking Time (proxy for FID)
      const tbt = audits['total-blocking-time'];
      if (tbt) {
        const tbtValue = tbt.numericValue; // In milliseconds
        findings.push({
          type: tbtValue <= 200 ? 'success' : tbtValue <= 600 ? 'warning' : 'error',
          message: `Total Blocking Time: ${Math.round(tbtValue)}ms`,
          details: tbtValue <= 200 ? 'Good (≤200ms)' : tbtValue <= 600 ? 'Needs Improvement' : 'Poor (>600ms)'
        });
        if (tbtValue > 200) {
          recommendations.push({
            priority: 'high',
            title: 'Reduce JavaScript execution time',
            description: 'Long tasks block the main thread and delay interactivity',
            actionable: 'Break up long tasks, remove unused JavaScript, defer non-critical scripts'
          });
        }
      }

      // CLS - Cumulative Layout Shift
      const cls = audits['cumulative-layout-shift'];
      if (cls) {
        const clsValue = cls.numericValue;
        findings.push({
          type: clsValue <= 0.1 ? 'success' : clsValue <= 0.25 ? 'warning' : 'error',
          message: `CLS: ${clsValue.toFixed(3)}`,
          details: clsValue <= 0.1 ? 'Good (≤0.1)' : clsValue <= 0.25 ? 'Needs Improvement' : 'Poor (>0.25)'
        });
        if (clsValue > 0.1) {
          recommendations.push({
            priority: 'medium',
            title: 'Reduce layout shifts',
            description: 'Content is moving around as the page loads',
            actionable: 'Add size attributes to images/videos, avoid inserting content above existing content'
          });
        }
      }

      // Speed Index
      const speedIndex = audits['speed-index'];
      if (speedIndex) {
        const siValue = speedIndex.numericValue / 1000;
        findings.push({
          type: siValue <= 3.4 ? 'success' : siValue <= 5.8 ? 'warning' : 'error',
          message: `Speed Index: ${siValue.toFixed(1)}s`,
          details: 'How quickly content is visually displayed'
        });
      }

      // First Contentful Paint
      const fcp = audits['first-contentful-paint'];
      if (fcp) {
        const fcpValue = fcp.numericValue / 1000;
        findings.push({
          type: fcpValue <= 1.8 ? 'success' : fcpValue <= 3 ? 'warning' : 'error',
          message: `First Contentful Paint: ${fcpValue.toFixed(1)}s`,
          details: 'Time until first content appears'
        });
      }

    } else {
      throw new Error('No Lighthouse data in response');
    }

  } catch (error) {
    console.error('[Scanner:Performance] PageSpeed API failed:', error);
    score = 50;
    findings.push({
      type: 'warning',
      message: 'Could not fetch PageSpeed data',
      details: error instanceof Error ? error.message : 'API request failed'
    });

    recommendations.push({
      priority: 'high',
      title: 'Optimize images',
      description: 'Compress and serve images in modern formats (WebP, AVIF)',
      actionable: 'Use Next.js Image component for automatic optimization'
    });

    recommendations.push({
      priority: 'medium',
      title: 'Enable caching',
      description: 'Configure proper cache headers for static assets',
      actionable: 'Set up CDN with Vercel or Cloudflare'
    });
  }

  return {
    phaseName: 'Performance',
    score,
    maxScore,
    findings,
    recommendations
  };
}

/**
 * Phase 4: Security
 * Checks HTTPS, security headers, and common vulnerabilities
 */
export async function checkSecurity(url: string): Promise<ScanPhaseResult> {
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];
  let score = 0;
  const maxScore = 100;

  const urlObj = new URL(url);

  // Check HTTPS (30 points)
  if (urlObj.protocol === 'https:') {
    score += 30;
    findings.push({
      type: 'success',
      message: 'HTTPS enabled',
      details: 'Encrypted connection protects data in transit'
    });
  } else {
    findings.push({
      type: 'error',
      message: 'HTTPS not enabled',
      details: 'Data is transmitted in plain text'
    });
    recommendations.push({
      priority: 'high',
      title: 'Enable HTTPS',
      description: 'All modern sites should use HTTPS',
      actionable: 'Get an SSL certificate (free via Let\'s Encrypt or your host)'
    });
  }

  // Fetch headers to check security configuration
  try {
    console.log('[Scanner:Security] Checking security headers...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LaunchReady/1.0; +https://launchready.me)'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeoutId);

    const headers = response.headers;

    // Check Strict-Transport-Security (HSTS) - 15 points
    const hsts = headers.get('strict-transport-security');
    if (hsts) {
      score += 15;
      findings.push({
        type: 'success',
        message: 'HSTS enabled',
        details: 'Forces browsers to use HTTPS'
      });
    } else {
      recommendations.push({
        priority: 'high',
        title: 'Add HSTS header',
        description: 'Strict-Transport-Security prevents protocol downgrade attacks',
        actionable: 'Add header: Strict-Transport-Security: max-age=31536000; includeSubDomains'
      });
    }

    // Check X-Frame-Options or CSP frame-ancestors - 10 points
    const xfo = headers.get('x-frame-options');
    const csp = headers.get('content-security-policy');
    const hasFrameProtection = xfo || csp?.includes('frame-ancestors');
    if (hasFrameProtection) {
      score += 10;
      findings.push({
        type: 'success',
        message: 'Clickjacking protection enabled',
        details: xfo ? `X-Frame-Options: ${xfo}` : 'CSP frame-ancestors configured'
      });
    } else {
      recommendations.push({
        priority: 'medium',
        title: 'Add clickjacking protection',
        description: 'Prevent your site from being embedded in malicious frames',
        actionable: 'Add header: X-Frame-Options: DENY or Content-Security-Policy: frame-ancestors \'none\''
      });
    }

    // Check X-Content-Type-Options - 10 points
    const xcto = headers.get('x-content-type-options');
    if (xcto === 'nosniff') {
      score += 10;
      findings.push({
        type: 'success',
        message: 'MIME sniffing protection enabled',
        details: 'X-Content-Type-Options: nosniff'
      });
    } else {
      recommendations.push({
        priority: 'medium',
        title: 'Add X-Content-Type-Options',
        description: 'Prevents browsers from MIME-sniffing responses',
        actionable: 'Add header: X-Content-Type-Options: nosniff'
      });
    }

    // Check Content-Security-Policy - 15 points
    if (csp) {
      score += 15;
      findings.push({
        type: 'success',
        message: 'Content Security Policy configured',
        details: 'CSP helps prevent XSS and data injection attacks'
      });
    } else {
      recommendations.push({
        priority: 'high',
        title: 'Add Content Security Policy',
        description: 'CSP is the most effective protection against XSS attacks',
        actionable: 'Start with: Content-Security-Policy: default-src \'self\'; script-src \'self\''
      });
    }

    // Check X-XSS-Protection (legacy but still useful) - 5 points
    const xxss = headers.get('x-xss-protection');
    if (xxss) {
      score += 5;
      findings.push({
        type: 'success',
        message: 'XSS filter enabled',
        details: `X-XSS-Protection: ${xxss}`
      });
    }

    // Check Referrer-Policy - 5 points
    const refPolicy = headers.get('referrer-policy');
    if (refPolicy) {
      score += 5;
      findings.push({
        type: 'success',
        message: 'Referrer policy configured',
        details: `Referrer-Policy: ${refPolicy}`
      });
    } else {
      recommendations.push({
        priority: 'low',
        title: 'Add Referrer-Policy',
        description: 'Controls how much referrer information is shared',
        actionable: 'Add header: Referrer-Policy: strict-origin-when-cross-origin'
      });
    }

    // Check Permissions-Policy - 10 points
    const permPolicy = headers.get('permissions-policy') || headers.get('feature-policy');
    if (permPolicy) {
      score += 10;
      findings.push({
        type: 'success',
        message: 'Permissions Policy configured',
        details: 'Controls browser feature access'
      });
    } else {
      recommendations.push({
        priority: 'low',
        title: 'Add Permissions-Policy',
        description: 'Control which browser features your site can use',
        actionable: 'Add header: Permissions-Policy: geolocation=(), microphone=(), camera=()'
      });
    }

  } catch (error) {
    console.log('[Scanner:Security] Could not fetch headers:', error);
    // Still give points for HTTPS if enabled
    score = Math.max(score, urlObj.protocol === 'https:' ? 40 : 10);
    findings.push({
      type: 'warning',
      message: 'Could not check security headers',
      details: 'Headers check timed out or failed'
    });
  }

  // Check page content for potential issues
  const pageData = pageCache.get(url);
  if (pageData?.loaded) {
    // Check for inline event handlers (potential XSS vectors)
    const inlineHandlers = pageData.html.match(/\bon\w+\s*=\s*["'][^"']+["']/gi);
    if (inlineHandlers && inlineHandlers.length > 10) {
      findings.push({
        type: 'warning',
        message: 'Many inline event handlers detected',
        details: `${inlineHandlers.length} inline handlers - consider moving to external scripts`
      });
    }

    // Check for mixed content warnings
    if (urlObj.protocol === 'https:' && pageData.html.includes('http://')) {
      const httpResources = pageData.html.match(/http:\/\/[^"'\s]+\.(js|css|jpg|png|gif)/gi);
      if (httpResources && httpResources.length > 0) {
        findings.push({
          type: 'warning',
          message: 'Potential mixed content',
          details: `Found ${httpResources.length} HTTP resources on HTTPS page`
        });
        recommendations.push({
          priority: 'medium',
          title: 'Fix mixed content',
          description: 'HTTP resources on HTTPS pages cause security warnings',
          actionable: 'Update all resource URLs to use HTTPS'
        });
      }
    }
  }

  recommendations.push({
    priority: 'medium',
    title: 'Regular dependency updates',
    description: 'Keep dependencies updated to patch vulnerabilities',
    actionable: 'Run `npm audit` and `npm update` regularly'
  });

  return {
    phaseName: 'Security',
    score,
    maxScore,
    findings,
    recommendations
  };
}

/**
 * Phase 5: Analytics
 */
export async function checkAnalytics(url: string): Promise<ScanPhaseResult> {
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];
  let score = 0;
  const maxScore = 100;

  // Get cached page data (fetched once in scanProject)
  const pageData = pageCache.get(url) || await fetchPage(url);

  if (!pageData.loaded) {
    findings.push({
      type: 'error',
      message: 'Failed to load page',
      details: pageData.error || 'Could not fetch page for analysis'
    });
    return { phaseName: 'Analytics', score, maxScore, findings, recommendations };
  }

  // Analytics detection patterns
  const analyticsPatterns = {
    'Google Analytics': [
      /google-analytics\.com\/analytics\.js/,
      /googletagmanager\.com\/gtag\/js/,
      /googletagmanager\.com\/gtm\.js/,
      /ga\(.*create/,
      /gtag\(/
    ],
    'PostHog': [
      /posthog\.com\/static\/array\.js/,
      /posthog\.init\(/,
      /app\.posthog\.com/
    ],
    'Plausible': [
      /plausible\.io\/js\/plausible/,
      /plausible\.io\/js\/script/
    ],
    'Mixpanel': [
      /mixpanel\.com\/libs\/mixpanel/,
      /mixpanel\.init\(/
    ],
    'Segment': [
      /segment\.com\/analytics\.js/,
      /analytics\.load\(/
    ],
    'Heap': [
      /heapanalytics\.com/,
      /heap\.load\(/
    ],
    'Amplitude': [
      /amplitude\.com.*\.js/,
      /amplitude\.getInstance\(/
    ],
    'Hotjar': [
      /static\.hotjar\.com/,
      /hjid:/
    ],
    'Fathom': [
      /cdn\.usefathom\.com/,
      /fathom\(/
    ]
  };

  const detectedTools: string[] = [];

  // Check scripts
  for (const script of pageData.scripts) {
    for (const [toolName, patterns] of Object.entries(analyticsPatterns)) {
      if (patterns.some(pattern => pattern.test(script))) {
        if (!detectedTools.includes(toolName)) {
          detectedTools.push(toolName);
        }
      }
    }
  }

  // Check HTML content for inline analytics code
  for (const [toolName, patterns] of Object.entries(analyticsPatterns)) {
    if (patterns.some(pattern => pattern.test(pageData.html))) {
      if (!detectedTools.includes(toolName)) {
        detectedTools.push(toolName);
      }
    }
  }

  // Score based on detection
  if (detectedTools.length > 0) {
    score += 60; // Base score for having analytics
    findings.push({
      type: 'success',
      message: `Analytics tools detected: ${detectedTools.join(', ')}`,
      details: `Found ${detectedTools.length} analytics ${detectedTools.length === 1 ? 'tool' : 'tools'}`
    });

    // Bonus points for multiple tools (up to 20 points)
    if (detectedTools.length >= 2) {
      score += 20;
      findings.push({
        type: 'success',
        message: 'Multiple analytics tools configured',
        details: 'Good coverage with multiple tracking solutions'
      });
    }

    // Bonus points for privacy-focused analytics (up to 20 points)
    const privacyFocused = detectedTools.filter(tool =>
      ['Plausible', 'Fathom', 'PostHog'].includes(tool)
    );
    if (privacyFocused.length > 0) {
      score += 20;
      findings.push({
        type: 'success',
        message: 'Privacy-focused analytics detected',
        details: `${privacyFocused.join(', ')} respects user privacy`
      });
    }

    // Recommendations for improvement
    if (!detectedTools.some(tool => ['PostHog', 'Mixpanel', 'Amplitude', 'Heap'].includes(tool))) {
      recommendations.push({
        priority: 'medium',
        title: 'Add product analytics',
        description: 'Consider adding event-based analytics for deeper insights',
        actionable: 'Install PostHog, Mixpanel, or Amplitude for user behavior tracking'
      });
    }
  } else {
    findings.push({
      type: 'error',
      message: 'No analytics tools detected',
      details: 'Cannot track user behavior or measure conversions'
    });
    recommendations.push({
      priority: 'high',
      title: 'Install analytics',
      description: 'Set up analytics to understand your users',
      actionable: 'Add Google Analytics, PostHog, or Plausible to track visitors'
    });
    recommendations.push({
      priority: 'medium',
      title: 'Set up conversion tracking',
      description: 'Track key user actions (signups, purchases)',
      actionable: 'Define events and goals in your analytics platform'
    });
  }

  return {
    phaseName: 'Analytics',
    score,
    maxScore,
    findings,
    recommendations
  };
}

/**
 * Phase 6: Social Media
 */
export async function checkSocial(url: string): Promise<ScanPhaseResult> {
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];
  let score = 0;
  const maxScore = 100;

  // Get cached page data (fetched once in scanProject)
  const pageData = pageCache.get(url) || await fetchPage(url);

  if (!pageData.loaded) {
    findings.push({
      type: 'error',
      message: 'Failed to load page',
      details: pageData.error || 'Could not fetch page for analysis'
    });
    return { phaseName: 'Social Media', score, maxScore, findings, recommendations };
  }

  // Check Open Graph tags (core tags: 40 points)
  const ogTitle = pageData.metaTags['og:title'];
  const ogDescription = pageData.metaTags['og:description'];
  const ogImage = pageData.metaTags['og:image'];
  const ogUrl = pageData.metaTags['og:url'];
  const ogType = pageData.metaTags['og:type'];
  const ogSiteName = pageData.metaTags['og:site_name'];

  const hasOGCore = !!(ogTitle && ogDescription && ogImage);
  const hasOGExtended = !!(ogUrl && ogType);

  if (hasOGCore) {
    score += 40;
    findings.push({
      type: 'success',
      message: 'Core Open Graph tags present',
      details: 'og:title, og:description, and og:image are configured'
    });

    if (hasOGExtended) {
      score += 10;
      findings.push({
        type: 'success',
        message: 'Extended Open Graph tags present',
        details: 'og:url and og:type enhance social sharing'
      });
    }

    if (ogSiteName) {
      score += 5;
    }
  } else {
    const missing = [
      !ogTitle && 'og:title',
      !ogDescription && 'og:description',
      !ogImage && 'og:image'
    ].filter(Boolean).join(', ');

    findings.push({
      type: 'error',
      message: 'Missing core Open Graph tags',
      details: `Missing: ${missing}`
    });
    recommendations.push({
      priority: 'high',
      title: 'Add Open Graph tags',
      description: 'Open Graph tags control how your site appears when shared on Facebook, LinkedIn, and other platforms',
      actionable: 'Add og:title, og:description, and og:image to your page metadata'
    });
  }

  // Check Twitter Card tags (35 points)
  const twitterCard = pageData.metaTags['twitter:card'];
  const twitterTitle = pageData.metaTags['twitter:title'];
  const twitterDescription = pageData.metaTags['twitter:description'];
  const twitterImage = pageData.metaTags['twitter:image'];
  const twitterSite = pageData.metaTags['twitter:site'];

  const hasTwitterCore = !!(twitterCard && (twitterTitle || ogTitle) && (twitterImage || ogImage));

  if (hasTwitterCore) {
    score += 30;
    findings.push({
      type: 'success',
      message: 'Twitter Card tags present',
      details: `Card type: ${twitterCard}`
    });

    if (twitterSite) {
      score += 5;
      findings.push({
        type: 'success',
        message: 'Twitter site attribution configured',
        details: `@${twitterSite.replace('@', '')}`
      });
    }
  } else {
    findings.push({
      type: 'warning',
      message: 'Twitter Card tags missing or incomplete',
      details: 'Twitter will fall back to Open Graph tags, but explicit Twitter tags provide better control'
    });
    recommendations.push({
      priority: 'medium',
      title: 'Add Twitter Card tags',
      description: 'Twitter Cards enhance how your content appears when shared on Twitter/X',
      actionable: 'Add twitter:card (summary_large_image), twitter:title, twitter:description, and twitter:image'
    });
  }

  // Check image quality and format (10 points bonus)
  if (ogImage) {
    // Check if image URL is absolute
    if (ogImage.startsWith('http://') || ogImage.startsWith('https://')) {
      score += 5;
      findings.push({
        type: 'success',
        message: 'Open Graph image URL is absolute',
        details: 'Image will display correctly when shared'
      });
    } else {
      findings.push({
        type: 'warning',
        message: 'Open Graph image URL is relative',
        details: 'Use absolute URLs (https://...) for reliable social sharing'
      });
      recommendations.push({
        priority: 'medium',
        title: 'Use absolute image URLs',
        description: 'Relative image URLs may not work when content is shared',
        actionable: 'Change og:image to use full https:// URL'
      });
    }

    // Check for image dimensions tags
    const ogImageWidth = pageData.metaTags['og:image:width'];
    const ogImageHeight = pageData.metaTags['og:image:height'];

    if (ogImageWidth && ogImageHeight) {
      score += 5;
      findings.push({
        type: 'success',
        message: 'Image dimensions specified',
        details: `${ogImageWidth}x${ogImageHeight} - helps platforms render faster`
      });
    }
  }

  // Overall assessment
  if (score >= 80) {
    findings.push({
      type: 'success',
      message: 'Excellent social media optimization',
      details: 'Your site will look great when shared on social platforms'
    });
  } else if (score >= 50) {
    findings.push({
      type: 'warning',
      message: 'Good social media setup, but could be improved',
      details: 'Consider adding missing tags for better social sharing'
    });
  } else if (score < 50 && score > 0) {
    findings.push({
      type: 'warning',
      message: 'Basic social media tags present',
      details: 'Add more tags to improve how your site appears when shared'
    });
  }

  return {
    phaseName: 'Social Media',
    score,
    maxScore,
    findings,
    recommendations
  };
}

/**
 * Phase 7: Content Quality
 * Uses OpenAI GPT-4 for intelligent content analysis
 */
export async function checkContent(url: string): Promise<ScanPhaseResult> {
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];
  let score = 0;
  const maxScore = 100;

  const apiKey = process.env.OPENAI_API_KEY;
  const pageData = pageCache.get(url);

  console.log('[Scanner:Content] API key present:', !!apiKey, 'Page loaded:', !!pageData?.loaded);

  // If page didn't load, return error
  if (!pageData?.loaded) {
    findings.push({
      type: 'error',
      message: 'Failed to load page',
      details: pageData?.error || 'Could not fetch page for analysis'
    });
    return { phaseName: 'Content Quality', score: 0, maxScore, findings, recommendations };
  }

  // Helper function for basic pattern-based content analysis
  function runBasicAnalysis(): ScanPhaseResult {
    console.log('[Scanner:Content] Running basic pattern analysis');
    // We know pageData exists and is loaded at this point
    const pd = pageData!;
    const html = pd.html.toLowerCase();
    const title = pd.title?.toLowerCase() || '';
    
    // Check for clear CTA
    const ctaPatterns = [
      /sign\s*up/i, /get\s*started/i, /try\s*(it\s*)?free/i, /start\s*(your\s*)?(free\s*)?trial/i,
      /book\s*(a\s*)?demo/i, /contact\s*us/i, /learn\s*more/i, /buy\s*now/i, /subscribe/i
    ];
    const hasCTA = ctaPatterns.some(pattern => pattern.test(html));
    if (hasCTA) {
      score += 25;
      findings.push({
        type: 'success',
        message: 'Call-to-action detected',
        details: 'Page has clear user action prompts'
      });
    } else {
      recommendations.push({
        priority: 'high',
        title: 'Add clear call-to-action',
        description: 'Every landing page needs a clear next step for visitors',
        actionable: 'Add prominent "Get Started", "Sign Up", or "Learn More" buttons'
      });
    }

    // Check for social proof indicators
    const socialProofPatterns = [
      /testimonial/i, /review/i, /customer/i, /trusted\s*by/i, /used\s*by/i,
      /\d+\s*(k|\+)?\s*(users|customers|companies)/i, /as\s*seen\s*(on|in)/i,
      /rating/i, /stars?/i
    ];
    const hasSocialProof = socialProofPatterns.some(pattern => pattern.test(html));
    if (hasSocialProof) {
      score += 20;
      findings.push({
        type: 'success',
        message: 'Social proof detected',
        details: 'Testimonials, reviews, or trust indicators found'
      });
    } else {
      recommendations.push({
        priority: 'medium',
        title: 'Add social proof',
        description: 'Include testimonials, logos, or metrics to build trust',
        actionable: 'Feature 3-5 customer quotes, company logos, or usage stats'
      });
    }

    // Check title quality
    if (title.length >= 30 && title.length <= 70) {
      score += 15;
      findings.push({
        type: 'success',
        message: 'Page title is well-sized',
        details: `${title.length} characters - good for readability`
      });
    }

    // Check for headline (H1)
    const h1Match = pd.html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match && h1Match[1].length > 10) {
      score += 15;
      findings.push({
        type: 'success',
        message: 'Main headline (H1) present',
        details: `"${h1Match[1].substring(0, 50)}${h1Match[1].length > 50 ? '...' : ''}"`
      });
    } else {
      recommendations.push({
        priority: 'high',
        title: 'Add compelling headline',
        description: 'Your H1 should clearly communicate your value proposition',
        actionable: 'Write a headline that answers "What do you offer and why should I care?"'
      });
    }

    // Base score for having content
    score += 15;

    // Generic recommendations
    recommendations.push({
      priority: 'high',
      title: 'Write compelling copy',
      description: 'Clear value proposition above the fold',
      actionable: 'Answer: What problem do you solve? Why should I care?'
    });

    return { phaseName: 'Content Quality', score: Math.max(score, 35), maxScore, findings, recommendations };
  }

  // If no API key, use basic analysis
  if (!apiKey) {
    console.log('[Scanner:Content] No OpenAI API key, using basic analysis');
    return runBasicAnalysis();
  }

  // Use OpenAI GPT-4 for intelligent content analysis
  try {
    console.log('[Scanner:Content] Analyzing content with GPT-4...');
    
    // Extract visible text content (simplified)
    const textContent = pageData.html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 4000); // Limit for API

    const systemPrompt = `You are a landing page optimization expert. Analyze the provided page content and return a JSON object with:
- score: number 0-100 (overall content quality)
- valueProposition: { clear: boolean, message: string }
- headline: { effective: boolean, feedback: string }
- cta: { present: boolean, clear: boolean, feedback: string }
- socialProof: { present: boolean, type: string }
- readability: { score: "good"|"fair"|"poor", feedback: string }
- improvements: array of { priority: "high"|"medium"|"low", issue: string, fix: string }
Be concise. Return only valid JSON.`;

    const userPrompt = `Analyze this landing page content:\n\nTitle: ${pageData.title}\nDescription: ${pageData.metaTags['description'] || 'None'}\n\nContent:\n${textContent}`;

    const aiResponse = await callOpenAI(userPrompt, systemPrompt, 800);

    if (!aiResponse) {
      console.log('[Scanner:Content] OpenAI call failed, falling back to basic analysis');
      return runBasicAnalysis();
    }

    const content = aiResponse;
    
    if (content) {
      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        
        score = analysis.score || 50;

        // Value Proposition
        if (analysis.valueProposition?.clear) {
          findings.push({
            type: 'success',
            message: 'Clear value proposition',
            details: analysis.valueProposition.message
          });
        } else {
          findings.push({
            type: 'warning',
            message: 'Value proposition unclear',
            details: analysis.valueProposition?.message || 'Visitors may not understand what you offer'
          });
          recommendations.push({
            priority: 'high',
            title: 'Clarify your value proposition',
            description: 'Visitors should instantly understand what you offer',
            actionable: 'Lead with the main benefit in your headline'
          });
        }

        // Headline
        if (analysis.headline?.effective) {
          findings.push({
            type: 'success',
            message: 'Effective headline',
            details: analysis.headline.feedback
          });
        } else {
          findings.push({
            type: 'warning',
            message: 'Headline needs work',
            details: analysis.headline?.feedback || 'Could be more compelling'
          });
        }

        // CTA
        if (analysis.cta?.present && analysis.cta?.clear) {
          findings.push({
            type: 'success',
            message: 'Clear call-to-action',
            details: analysis.cta.feedback
          });
        } else if (analysis.cta?.present) {
          findings.push({
            type: 'warning',
            message: 'CTA could be clearer',
            details: analysis.cta?.feedback
          });
        } else {
          findings.push({
            type: 'error',
            message: 'Missing call-to-action',
            details: 'No clear next step for visitors'
          });
          recommendations.push({
            priority: 'high',
            title: 'Add clear call-to-action',
            description: 'Every page needs a clear next step',
            actionable: 'Add prominent action buttons above the fold'
          });
        }

        // Social Proof
        if (analysis.socialProof?.present) {
          findings.push({
            type: 'success',
            message: 'Social proof present',
            details: `Type: ${analysis.socialProof.type}`
          });
        } else {
          recommendations.push({
            priority: 'medium',
            title: 'Add social proof',
            description: 'Testimonials and trust signals increase conversions',
            actionable: 'Add customer quotes, logos, or metrics'
          });
        }

        // Readability
        findings.push({
          type: analysis.readability?.score === 'good' ? 'success' : 'warning',
          message: `Readability: ${analysis.readability?.score || 'unknown'}`,
          details: analysis.readability?.feedback || ''
        });

        // Add AI-generated improvements
        if (analysis.improvements && Array.isArray(analysis.improvements)) {
          for (const improvement of analysis.improvements.slice(0, 3)) {
            recommendations.push({
              priority: improvement.priority || 'medium',
              title: improvement.issue,
              description: improvement.fix,
              actionable: improvement.fix
            });
          }
        }
      }
    }

  } catch (error) {
    console.error('[Scanner:Content] OpenAI API failed:', error);
    // Fall back to basic analysis on error
    return runBasicAnalysis();
  }

  return {
    phaseName: 'Content Quality',
    score,
    maxScore,
    findings,
    recommendations
  };
}

/**
 * Phase 8: Monitoring
 * Detects error tracking, logging, and monitoring tools
 */
export async function checkMonitoring(url: string): Promise<ScanPhaseResult> {
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];
  let score = 0;
  const maxScore = 100;

  const pageData = pageCache.get(url);

  if (!pageData?.loaded) {
    score = 20;
    findings.push({
      type: 'warning',
      message: 'Could not analyze monitoring setup',
      details: 'Page data not available'
    });
  } else {
    // Error tracking/monitoring detection patterns
    const monitoringPatterns = {
      'Sentry': [
        /sentry\.io/i,
        /sentry-cdn/i,
        /Sentry\.init\(/i,
        /@sentry\//i,
        /dsn.*sentry/i
      ],
      'BugSnag': [
        /bugsnag/i,
        /Bugsnag\.start\(/i
      ],
      'Rollbar': [
        /rollbar\.com/i,
        /Rollbar\.init\(/i
      ],
      'LogRocket': [
        /logrocket/i,
        /LogRocket\.init\(/i
      ],
      'Datadog': [
        /datadoghq/i,
        /DD_RUM/i,
        /datadog-rum/i
      ],
      'New Relic': [
        /newrelic/i,
        /NREUM/i,
        /nr-rum/i
      ],
      'Raygun': [
        /raygun/i,
        /Raygun\.init\(/i
      ],
      'TrackJS': [
        /trackjs/i
      ],
      'Airbrake': [
        /airbrake/i
      ],
      'FullStory': [
        /fullstory/i,
        /FullStory\.init\(/i
      ],
      'Clarity': [
        /clarity\.ms/i
      ],
      'Vercel Analytics': [
        /vercel-analytics/i,
        /_vercel/i,
        /vitals\.vercel-analytics/i
      ],
      'Vercel Speed Insights': [
        /speed-insights/i,
        /@vercel\/speed-insights/i
      ]
    };

    const detectedTools: string[] = [];

    // Check scripts
    for (const script of pageData.scripts) {
      for (const [toolName, patterns] of Object.entries(monitoringPatterns)) {
        if (patterns.some(pattern => pattern.test(script))) {
          if (!detectedTools.includes(toolName)) {
            detectedTools.push(toolName);
          }
        }
      }
    }

    // Check HTML for inline monitoring code
    for (const [toolName, patterns] of Object.entries(monitoringPatterns)) {
      if (patterns.some(pattern => pattern.test(pageData.html))) {
        if (!detectedTools.includes(toolName)) {
          detectedTools.push(toolName);
        }
      }
    }

    // Categorize detected tools
    const errorTrackers = detectedTools.filter(t => 
      ['Sentry', 'BugSnag', 'Rollbar', 'Raygun', 'TrackJS', 'Airbrake'].includes(t)
    );
    const sessionRecorders = detectedTools.filter(t =>
      ['LogRocket', 'FullStory', 'Clarity'].includes(t)
    );
    const apm = detectedTools.filter(t =>
      ['Datadog', 'New Relic', 'Vercel Analytics', 'Vercel Speed Insights'].includes(t)
    );

    // Score based on detection
    if (errorTrackers.length > 0) {
      score += 40;
      findings.push({
        type: 'success',
        message: `Error tracking: ${errorTrackers.join(', ')}`,
        details: 'Errors are being captured and monitored'
      });
    } else {
      findings.push({
        type: 'error',
        message: 'No error tracking detected',
        details: 'Production errors may go unnoticed'
      });
      recommendations.push({
        priority: 'high',
        title: 'Set up error tracking',
        description: 'Catch and track production errors before users report them',
        actionable: 'Install Sentry (free tier available) - npm install @sentry/nextjs'
      });
    }

    if (sessionRecorders.length > 0) {
      score += 20;
      findings.push({
        type: 'success',
        message: `Session recording: ${sessionRecorders.join(', ')}`,
        details: 'User sessions are being recorded for debugging'
      });
    } else {
      recommendations.push({
        priority: 'low',
        title: 'Consider session recording',
        description: 'See exactly what users experience when issues occur',
        actionable: 'Try LogRocket, FullStory, or Microsoft Clarity (free)'
      });
    }

    if (apm.length > 0) {
      score += 25;
      findings.push({
        type: 'success',
        message: `Performance monitoring: ${apm.join(', ')}`,
        details: 'Application performance is being tracked'
      });
    } else {
      recommendations.push({
        priority: 'medium',
        title: 'Add performance monitoring',
        description: 'Track Core Web Vitals and server performance',
        actionable: 'Enable Vercel Analytics or add Datadog RUM'
      });
    }

    // Check for robots.txt (indicates some site management)
    try {
      const robotsUrl = new URL('/robots.txt', url).toString();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const robotsResponse = await fetch(robotsUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'LaunchReady/1.0' }
      });
      clearTimeout(timeoutId);
      
      if (robotsResponse.ok) {
        score += 10;
        findings.push({
          type: 'success',
          message: 'robots.txt present',
          details: 'Search engine crawling is configured'
        });
      }
    } catch {
      // robots.txt check failed, not critical
    }

    // Check for sitemap
    const hasSitemap = pageData.html.includes('sitemap') || 
                       pageData.metaTags['sitemap'] !== undefined;
    if (hasSitemap) {
      score += 5;
      findings.push({
        type: 'success',
        message: 'Sitemap reference found',
        details: 'Helps search engines discover all pages'
      });
    }

    // No tools detected at all
    if (detectedTools.length === 0) {
      score = 15;
      findings.push({
        type: 'warning',
        message: 'No monitoring tools detected',
        details: 'Consider adding error tracking and analytics'
      });
    }
  }

  // Always recommend uptime monitoring (can't detect from page)
  recommendations.push({
    priority: 'high',
    title: 'Configure uptime monitoring',
    description: 'Get alerted if your site goes down',
    actionable: 'Use UptimeRobot (free), Pingdom, or Better Stack'
  });

  return {
    phaseName: 'Monitoring & Alerts',
    score,
    maxScore,
    findings,
    recommendations
  };
}

/**
 * Main scanning function - runs all 8 phases
 * Optimized to fetch page data once and reuse it
 */
export async function scanProject(url: string): Promise<ScanResult> {
  const startTime = Date.now();
  console.log(`[Scanner] Starting scan for ${url}`);

  // Fetch page data once upfront for better performance
  // This is used by SEO, Analytics, Social phases
  console.log('[Scanner] Fetching page via Browserless...');
  const fetchStart = Date.now();
  
  let pageData: PageData;
  try {
    pageData = await fetchPage(url);
    console.log(`[Scanner] Page fetch completed in ${Date.now() - fetchStart}ms`);
  } catch (error) {
    console.error('[Scanner] Page fetch failed:', error);
    // Create a fallback page data so we can still run some phases
    pageData = {
      html: '',
      title: '',
      metaTags: {},
      scripts: [],
      loaded: false,
      error: error instanceof Error ? error.message : 'Failed to fetch page'
    };
  }

  // Store in module cache for phase functions to access
  pageCache.set(url, pageData);

  try {
    // Run all 8 phases
    console.log('[Scanner] Running all 8 phases...');
    const phaseStart = Date.now();
    
    const phases = [
      await checkDomain(url),
      await checkSEO(url),
      await checkPerformance(url),
      await checkSecurity(url),
      await checkAnalytics(url),
      await checkSocial(url),
      await checkContent(url),
      await checkMonitoring(url)
    ];
    
    console.log(`[Scanner] All 8 phases completed in ${Date.now() - phaseStart}ms`);

    const totalScore = phases.reduce((sum, phase) => sum + phase.score, 0);
    const maxScore = phases.reduce((sum, phase) => sum + phase.maxScore, 0);
    const score = Math.round((totalScore / maxScore) * 100);

    // Generate executive summary and top priorities using LLM
    let executiveSummary: string | undefined;
    let topPriorities: string[] | undefined;

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      console.log('[Scanner] Generating executive summary with GPT-4...');
      
      // Collect all high-priority recommendations
      const allRecommendations = phases.flatMap(p => 
        p.recommendations.map(r => ({
          phase: p.phaseName,
          priority: r.priority,
          title: r.title,
          actionable: r.actionable
        }))
      );
      
      const highPriority = allRecommendations.filter(r => r.priority === 'high');
      const mediumPriority = allRecommendations.filter(r => r.priority === 'medium');
      
      // Build phase summary
      const phaseSummary = phases.map(p => 
        `${p.phaseName}: ${p.score}/${p.maxScore} (${Math.round(p.score/p.maxScore*100)}%)`
      ).join('\n');

      const summaryPrompt = `Based on this website scan:

URL: ${url}
Overall Score: ${score}/100

Phase Scores:
${phaseSummary}

Top Issues (High Priority):
${highPriority.slice(0, 5).map(r => `- ${r.phase}: ${r.title}`).join('\n') || 'None'}

Medium Priority Issues:
${mediumPriority.slice(0, 3).map(r => `- ${r.phase}: ${r.title}`).join('\n') || 'None'}

Generate:
1. A 2-3 sentence executive summary of the site's launch readiness
2. Top 3 specific actions to improve the score (be actionable and specific)

Format as JSON: { "summary": "...", "priorities": ["action 1", "action 2", "action 3"] }`;

      const summarySystemPrompt = 'You are a launch readiness consultant. Be concise and actionable. Return only valid JSON.';
      
      try {
        const summaryResponse = await callOpenAI(summaryPrompt, summarySystemPrompt, 400);
        if (summaryResponse) {
          const jsonMatch = summaryResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            executiveSummary = parsed.summary;
            topPriorities = parsed.priorities;
            console.log('[Scanner] Executive summary generated successfully');
          }
        }
      } catch (error) {
        console.error('[Scanner] Failed to generate executive summary:', error);
      }
    }

    console.log(`[Scanner] Scan completed in ${Date.now() - startTime}ms - Score: ${score}/100`);

    return {
      url,
      score,
      maxScore: 100,
      phases,
      scannedAt: new Date(),
      executiveSummary,
      topPriorities
    };
  } finally {
    // Clean up cache after scan completes
    pageCache.delete(url);
  }
}
