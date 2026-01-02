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
 */
export async function checkPerformance(url: string): Promise<ScanPhaseResult> {
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];
  let score = 0;
  const maxScore = 100;

  findings.push({
    type: 'warning',
    message: 'Performance check requires page load',
    details: 'Upgrade to Pro for PageSpeed Insights integration'
  });

  score = 50;

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
 */
export async function checkSecurity(url: string): Promise<ScanPhaseResult> {
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];
  let score = 0;
  const maxScore = 100;

  const urlObj = new URL(url);

  if (urlObj.protocol === 'https:') {
    score += 50;
    findings.push({
      type: 'success',
      message: 'HTTPS enabled',
      details: 'Basic transport security is in place'
    });
  }

  recommendations.push({
    priority: 'high',
    title: 'Add security headers',
    description: 'Implement CSP, X-Frame-Options, etc.',
    actionable: 'Configure security headers in next.config.js'
  });

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
 */
export async function checkContent(url: string): Promise<ScanPhaseResult> {
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];
  let score = 0;
  const maxScore = 100;

  findings.push({
    type: 'warning',
    message: 'Content analysis requires AI',
    details: 'Upgrade to Pro for GPT-4 powered content audit'
  });

  score = 40;

  recommendations.push({
    priority: 'high',
    title: 'Write compelling copy',
    description: 'Clear value proposition above the fold',
    actionable: 'Answer: What problem do you solve? Why should I care?'
  });

  recommendations.push({
    priority: 'medium',
    title: 'Add social proof',
    description: 'Include testimonials, logos, or metrics',
    actionable: 'Feature 3-5 customer quotes or trust badges'
  });

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
 */
export async function checkMonitoring(url: string): Promise<ScanPhaseResult> {
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];
  let score = 0;
  const maxScore = 100;

  score = 20; // Default low score for monitoring

  recommendations.push({
    priority: 'high',
    title: 'Set up error tracking',
    description: 'Install Sentry or similar error monitoring',
    actionable: 'Catch and track production errors before users report them'
  });

  recommendations.push({
    priority: 'high',
    title: 'Configure uptime monitoring',
    description: 'Get alerted if your site goes down',
    actionable: 'Use UptimeRobot, Pingdom, or Vercel monitoring'
  });

  recommendations.push({
    priority: 'medium',
    title: 'Monitor performance',
    description: 'Track Core Web Vitals and load times',
    actionable: 'Set up Web Vitals tracking in analytics'
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
  // Fetch page data once upfront for better performance
  // This is used by checkSEO, checkPerformance, and checkContent
  const pageData = await fetchPage(url);

  // Store in module cache for phase functions to access
  pageCache.set(url, pageData);

  try {
    const phases = await Promise.all([
      checkDomain(url),
      checkSEO(url),
      checkPerformance(url),
      checkSecurity(url),
      checkAnalytics(url),
      checkSocial(url),
      checkContent(url),
      checkMonitoring(url)
    ]);

    const totalScore = phases.reduce((sum, phase) => sum + phase.score, 0);
    const maxScore = phases.reduce((sum, phase) => sum + phase.maxScore, 0);
    const score = Math.round((totalScore / maxScore) * 100);

    return {
      url,
      score,
      maxScore: 100,
      phases,
      scannedAt: new Date()
    };
  } finally {
    // Clean up cache after scan completes
    pageCache.delete(url);
  }
}
