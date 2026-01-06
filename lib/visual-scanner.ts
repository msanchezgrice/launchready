/**
 * Visual Scanner - Design and UX Analysis
 * Uses Playwright/Browserless to capture screenshots and analyze visual quality
 */

import { chromium, Browser, Page } from 'playwright-core'

export interface VisualScanResult {
  success: boolean
  screenshots: {
    desktop?: string  // Base64 encoded
    mobile?: string   // Base64 encoded
  }
  findings: VisualFinding[]
  recommendations: VisualRecommendation[]
  metrics: VisualMetrics
  error?: string
}

export interface VisualFinding {
  type: 'success' | 'warning' | 'error'
  category: 'design' | 'mobile' | 'typography' | 'accessibility' | 'performance'
  message: string
  details?: string
}

export interface VisualRecommendation {
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  actionable: string
}

export interface VisualMetrics {
  loadTime?: number
  fontsLoaded?: number
  imagesCount?: number
  hasViewportMeta?: boolean
  hasFavicon?: boolean
  colorContrast?: 'good' | 'needs-review' | 'unknown'
  mobileResponsive?: boolean
}

// Viewport configurations
const VIEWPORTS = {
  desktop: { width: 1280, height: 720 },
  mobile: { width: 375, height: 667 },  // iPhone SE
}

/**
 * Run visual analysis on a URL
 * Returns screenshots and design findings
 */
export async function runVisualScan(url: string): Promise<VisualScanResult> {
  const browserlessApiKey = process.env.BROWSERLESS_API_KEY
  
  console.log('[Visual Scanner] Starting visual scan for:', url)
  
  if (!browserlessApiKey) {
    console.log('[Visual Scanner] Browserless not configured, skipping visual scan')
    return {
      success: false,
      screenshots: {},
      findings: [],
      recommendations: [],
      metrics: {},
      error: 'Browserless API key not configured'
    }
  }

  let browser: Browser | null = null
  const findings: VisualFinding[] = []
  const recommendations: VisualRecommendation[] = []
  const metrics: VisualMetrics = {}
  const screenshots: { desktop?: string; mobile?: string } = {}

  try {
    const browserlessUrl = `wss://chrome.browserless.io?token=${browserlessApiKey}`
    console.log('[Visual Scanner] Connecting to Browserless...')
    
    // 30 second timeout for connection
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Browserless connection timeout (30s)')), 30000)
    )
    
    browser = await Promise.race([
      chromium.connect(browserlessUrl),
      timeoutPromise
    ])
    
    console.log('[Visual Scanner] Connected!')

    // Desktop scan
    console.log('[Visual Scanner] Capturing desktop screenshot...')
    const desktopResult = await captureViewport(browser, url, VIEWPORTS.desktop, 'desktop')
    if (desktopResult.screenshot) {
      screenshots.desktop = desktopResult.screenshot
    }
    findings.push(...desktopResult.findings)
    Object.assign(metrics, desktopResult.metrics)

    // Mobile scan
    console.log('[Visual Scanner] Capturing mobile screenshot...')
    const mobileResult = await captureViewport(browser, url, VIEWPORTS.mobile, 'mobile')
    if (mobileResult.screenshot) {
      screenshots.mobile = mobileResult.screenshot
    }
    findings.push(...mobileResult.findings)

    // Check mobile responsiveness
    if (mobileResult.metrics.mobileResponsive === false) {
      recommendations.push({
        priority: 'high',
        title: 'Improve mobile responsiveness',
        description: 'Page may not be optimized for mobile devices',
        actionable: 'Add viewport meta tag and ensure responsive CSS breakpoints'
      })
    }

    // Check for viewport meta tag
    if (!metrics.hasViewportMeta) {
      recommendations.push({
        priority: 'high',
        title: 'Add viewport meta tag',
        description: 'Missing viewport meta tag for mobile optimization',
        actionable: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to your HTML head'
      })
    }

    // Check for favicon
    if (!metrics.hasFavicon) {
      recommendations.push({
        priority: 'medium',
        title: 'Add favicon',
        description: 'No favicon detected',
        actionable: 'Add a favicon.ico or use <link rel="icon"> in your HTML head'
      })
    }

    // Check load time
    if (metrics.loadTime && metrics.loadTime > 5000) {
      recommendations.push({
        priority: 'high',
        title: 'Improve page load time',
        description: `Page took ${(metrics.loadTime / 1000).toFixed(1)}s to load`,
        actionable: 'Optimize images, reduce JavaScript bundle size, and enable caching'
      })
    }

    // Check fonts
    if (metrics.fontsLoaded === 0) {
      findings.push({
        type: 'warning',
        category: 'typography',
        message: 'No custom fonts detected',
        details: 'Using system fonts only'
      })
    } else if (metrics.fontsLoaded && metrics.fontsLoaded > 0) {
      findings.push({
        type: 'success',
        category: 'typography',
        message: `${metrics.fontsLoaded} custom font(s) loaded`,
        details: 'Custom typography is configured'
      })
    }

    await browser.close()
    browser = null

    console.log('[Visual Scanner] Visual scan complete!')
    
    return {
      success: true,
      screenshots,
      findings,
      recommendations,
      metrics
    }

  } catch (error) {
    console.error('[Visual Scanner] Error:', error)
    if (browser) {
      try { await browser.close() } catch { /* ignore */ }
    }
    
    return {
      success: false,
      screenshots,
      findings,
      recommendations,
      metrics,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Capture a screenshot and analyze a specific viewport
 */
async function captureViewport(
  browser: Browser,
  url: string,
  viewport: { width: number; height: number },
  type: 'desktop' | 'mobile'
): Promise<{
  screenshot?: string
  findings: VisualFinding[]
  metrics: Partial<VisualMetrics>
}> {
  const findings: VisualFinding[] = []
  const metrics: Partial<VisualMetrics> = {}

  try {
    const context = await browser.newContext({
      userAgent: type === 'mobile' 
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport
    })

    const page = await context.newPage()
    
    const startTime = Date.now()
    
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000
    })
    
    const loadTime = Date.now() - startTime
    if (type === 'desktop') {
      metrics.loadTime = loadTime
    }

    // Wait a bit for fonts and images to load
    await page.waitForTimeout(1000)

    // Analyze page content
    const pageAnalysis = await page.evaluate(() => {
      // Check viewport meta
      const viewportMeta = document.querySelector('meta[name="viewport"]')
      const hasViewportMeta = !!viewportMeta
      
      // Check favicon
      const favicon = document.querySelector('link[rel="icon"]') || 
                     document.querySelector('link[rel="shortcut icon"]')
      const hasFavicon = !!favicon

      // Count images
      const images = document.querySelectorAll('img')
      const imagesCount = images.length

      // Check fonts (rough detection)
      const computedFonts = new Set<string>()
      document.querySelectorAll('h1, h2, h3, p, span, a, button').forEach(el => {
        const fontFamily = window.getComputedStyle(el).fontFamily
        computedFonts.add(fontFamily)
      })
      
      // Check if using custom fonts (not just system fonts)
      const systemFonts = ['Arial', 'Helvetica', 'sans-serif', 'serif', 'monospace', 'system-ui', '-apple-system']
      const hasCustomFonts = Array.from(computedFonts).some(font => 
        !systemFonts.some(sf => font.toLowerCase().includes(sf.toLowerCase()))
      )

      // Check for horizontal scroll (mobile responsiveness issue)
      const hasHorizontalScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth

      // Basic color contrast check (look for very light text)
      let potentialContrastIssues = 0
      document.querySelectorAll('p, span, a').forEach(el => {
        const style = window.getComputedStyle(el)
        const color = style.color
        // Very basic check for light gray text
        if (color.includes('rgb(')) {
          const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
          if (match) {
            const avg = (parseInt(match[1]) + parseInt(match[2]) + parseInt(match[3])) / 3
            if (avg > 200) potentialContrastIssues++
          }
        }
      })

      return {
        hasViewportMeta,
        hasFavicon,
        imagesCount,
        hasCustomFonts,
        hasHorizontalScroll,
        potentialContrastIssues
      }
    })

    // Store metrics
    if (type === 'desktop') {
      metrics.hasViewportMeta = pageAnalysis.hasViewportMeta
      metrics.hasFavicon = pageAnalysis.hasFavicon
      metrics.imagesCount = pageAnalysis.imagesCount
      metrics.fontsLoaded = pageAnalysis.hasCustomFonts ? 1 : 0
      metrics.colorContrast = pageAnalysis.potentialContrastIssues > 5 ? 'needs-review' : 'good'
    }
    
    if (type === 'mobile') {
      metrics.mobileResponsive = !pageAnalysis.hasHorizontalScroll
    }

    // Add findings
    if (type === 'desktop') {
      if (pageAnalysis.hasViewportMeta) {
        findings.push({
          type: 'success',
          category: 'mobile',
          message: 'Viewport meta tag present',
          details: 'Page is configured for mobile devices'
        })
      }

      if (pageAnalysis.hasFavicon) {
        findings.push({
          type: 'success',
          category: 'design',
          message: 'Favicon detected',
          details: 'Browser tab icon is configured'
        })
      }

      if (loadTime < 3000) {
        findings.push({
          type: 'success',
          category: 'performance',
          message: `Fast load time: ${(loadTime / 1000).toFixed(1)}s`,
          details: 'Page loads quickly'
        })
      } else if (loadTime < 5000) {
        findings.push({
          type: 'warning',
          category: 'performance',
          message: `Moderate load time: ${(loadTime / 1000).toFixed(1)}s`,
          details: 'Consider optimizing for faster loads'
        })
      } else {
        findings.push({
          type: 'error',
          category: 'performance',
          message: `Slow load time: ${(loadTime / 1000).toFixed(1)}s`,
          details: 'Page takes too long to load'
        })
      }
    }

    if (type === 'mobile') {
      if (!pageAnalysis.hasHorizontalScroll) {
        findings.push({
          type: 'success',
          category: 'mobile',
          message: 'Mobile responsive',
          details: 'No horizontal scrolling on mobile viewport'
        })
      } else {
        findings.push({
          type: 'error',
          category: 'mobile',
          message: 'Horizontal scroll detected on mobile',
          details: 'Page content overflows mobile viewport'
        })
      }
    }

    // Capture screenshot
    const screenshotBuffer = await page.screenshot({
      type: 'jpeg',
      quality: 80,
      fullPage: false  // Just viewport, not full page
    })
    
    const screenshot = screenshotBuffer.toString('base64')

    await context.close()

    return { screenshot, findings, metrics }

  } catch (error) {
    console.error(`[Visual Scanner] Error capturing ${type} viewport:`, error)
    return { findings, metrics }
  }
}

/**
 * Run visual scan in background (non-blocking)
 * Returns immediately with a job ID, results stored later
 */
export async function runVisualScanAsync(
  url: string,
  projectId: string,
  scanId: string
): Promise<{ queued: boolean; error?: string }> {
  // For now, just run synchronously but don't block
  // In a real implementation, this would add to a queue
  
  console.log(`[Visual Scanner] Queuing async visual scan for ${url}`)
  
  // Run in background (fire and forget)
  runVisualScan(url)
    .then(async (result) => {
      if (result.success) {
        console.log(`[Visual Scanner] Async scan complete for ${url}`)
        // Store results in database
        try {
          const { prisma } = await import('./prisma')
          // Get existing metadata first
          const existingScan = await prisma.scan.findUnique({
            where: { id: scanId },
            select: { metadata: true }
          })
          
          await prisma.scan.update({
            where: { id: scanId },
            data: {
              metadata: JSON.parse(JSON.stringify({
                ...(existingScan?.metadata as object || {}),
                visualScan: {
                  success: result.success,
                  hasDesktopScreenshot: !!result.screenshots.desktop,
                  hasMobileScreenshot: !!result.screenshots.mobile,
                  findings: result.findings,
                  recommendations: result.recommendations,
                  metrics: result.metrics,
                  // Store screenshot URLs or base64 (for now, we'll store truncated base64 ref)
                  desktopScreenshot: result.screenshots.desktop?.substring(0, 100) + '...[truncated]',
                  mobileScreenshot: result.screenshots.mobile?.substring(0, 100) + '...[truncated]',
                }
              }))
            }
          })
          console.log(`[Visual Scanner] Results saved for scan ${scanId}`)
        } catch (dbError) {
          console.error('[Visual Scanner] Failed to save results:', dbError)
        }
      }
    })
    .catch(err => {
      console.error('[Visual Scanner] Async scan failed:', err)
    })
  
  return { queued: true }
}
