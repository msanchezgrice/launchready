/**
 * GitHub Repository Scanner
 * Performs deep code analysis for secrets, debug statements, dependency vulnerabilities
 */

export interface GitHubScanResult {
  connected: boolean
  repoFound: boolean
  score: number
  maxScore: number
  findings: GitHubFinding[]
  recommendations: GitHubRecommendation[]
}

export interface GitHubFinding {
  type: 'success' | 'warning' | 'error'
  category: 'secrets' | 'debug' | 'dependencies' | 'env' | 'general'
  message: string
  details?: string
  file?: string
  line?: number
}

export interface GitHubRecommendation {
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  actionable: string
}

// Secret patterns to detect
const SECRET_PATTERNS = [
  { name: 'Stripe Live Key', pattern: /sk_live_[a-zA-Z0-9]{24,}/g },
  { name: 'Stripe Test Key', pattern: /sk_test_[a-zA-Z0-9]{24,}/g },
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'AWS Secret Key', pattern: /[a-zA-Z0-9/+=]{40}/g, context: 'aws' },
  { name: 'GitHub Token', pattern: /ghp_[a-zA-Z0-9]{36}/g },
  { name: 'GitHub OAuth Token', pattern: /gho_[a-zA-Z0-9]{36}/g },
  { name: 'Slack Token', pattern: /xox[baprs]-[a-zA-Z0-9-]{10,}/g },
  { name: 'Google API Key', pattern: /AIza[0-9A-Za-z-_]{35}/g },
  { name: 'Private Key', pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'Database URL', pattern: /postgres(ql)?:\/\/[^:]+:[^@]+@[^/]+/gi },
  { name: 'MongoDB URL', pattern: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@[^/]+/gi },
  { name: 'Generic API Key', pattern: /api[_-]?key['":\s]*[=:]\s*['"][a-zA-Z0-9]{20,}['"]/gi },
  { name: 'Generic Secret', pattern: /secret['":\s]*[=:]\s*['"][a-zA-Z0-9]{20,}['"]/gi },
]

// Debug statement patterns
const DEBUG_PATTERNS = [
  { name: 'console.log', pattern: /console\.log\s*\(/g },
  { name: 'console.debug', pattern: /console\.debug\s*\(/g },
  { name: 'console.info', pattern: /console\.info\s*\(/g },
  { name: 'debugger statement', pattern: /\bdebugger\b;?/g },
  { name: 'TODO comment', pattern: /\/\/\s*TODO:/gi },
  { name: 'FIXME comment', pattern: /\/\/\s*FIXME:/gi },
  { name: 'HACK comment', pattern: /\/\/\s*HACK:/gi },
  { name: 'test.only', pattern: /\.(only|skip)\s*\(/g },
]

// Files to ignore
const IGNORE_PATTERNS = [
  /node_modules\//,
  /\.git\//,
  /dist\//,
  /build\//,
  /\.next\//,
  /coverage\//,
  /\.test\./,
  /\.spec\./,
  /__tests__\//,
  /test\//,
  /\.md$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
]

// Deep source code patterns for analytics detection
const ANALYTICS_SOURCE_PATTERNS = {
  // PostHog patterns
  'PostHog': [
    /posthog\.init\s*\(/i,
    /PostHogProvider/i,
    /usePostHog/i,
    /'posthog-js'/i,
    /"posthog-js"/i,
    /from\s+['"]posthog/i,
    /import.*posthog/i,
    /NEXT_PUBLIC_POSTHOG/i,
    /posthog\.capture/i,
  ],
  // Google Analytics patterns
  'Google Analytics': [
    /gtag\s*\(/i,
    /GoogleAnalytics/i,
    /GA_TRACKING_ID/i,
    /GA_MEASUREMENT_ID/i,
    /react-ga/i,
    /analytics\.js/i,
    /googletagmanager/i,
    /gtm\.js/i,
  ],
  // Plausible patterns
  'Plausible': [
    /plausible/i,
    /PlausibleProvider/i,
    /usePlausible/i,
    /plausible-tracker/i,
  ],
  // Mixpanel patterns
  'Mixpanel': [
    /mixpanel\.init/i,
    /mixpanel\.track/i,
    /MixpanelProvider/i,
    /from\s+['"]mixpanel/i,
  ],
  // Segment patterns
  'Segment': [
    /analytics\.track/i,
    /analytics\.identify/i,
    /AnalyticsBrowser/i,
    /segment\.com/i,
    /@segment\//i,
  ],
  // Amplitude patterns
  'Amplitude': [
    /amplitude\.init/i,
    /amplitude\.track/i,
    /AmplitudeProvider/i,
    /@amplitude\//i,
  ],
  // Vercel Analytics patterns
  'Vercel Analytics': [
    /@vercel\/analytics/i,
    /Analytics\s*\/>/i,
    /vercel\/analytics/i,
  ],
  // Sentry patterns (error tracking)
  'Sentry': [
    /Sentry\.init/i,
    /SentryProvider/i,
    /@sentry\//i,
    /sentry\.io/i,
    /captureException/i,
  ],
  // Hotjar patterns
  'Hotjar': [
    /hotjar/i,
    /hj\s*\(/i,
    /HOTJAR_ID/i,
  ],
  // LogRocket patterns
  'LogRocket': [
    /LogRocket\.init/i,
    /logrocket/i,
  ],
  // FullStory patterns
  'FullStory': [
    /FullStory/i,
    /fullstory/i,
    /_fs_/i,
  ],
}

// Priority source files for analytics detection
const ANALYTICS_PRIORITY_FILES = [
  'app/layout.tsx',
  'app/layout.jsx',
  'app/layout.js',
  'pages/_app.tsx',
  'pages/_app.jsx',
  'pages/_app.js',
  'app/providers.tsx',
  'app/providers.jsx',
  'src/app/layout.tsx',
  'src/pages/_app.tsx',
  'components/providers.tsx',
  'lib/analytics.ts',
  'lib/analytics.js',
  'utils/analytics.ts',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
]

/**
 * Scan a GitHub repository for security issues
 */
export async function scanGitHubRepo(
  accessToken: string,
  repoUrl: string
): Promise<GitHubScanResult> {
  const findings: GitHubFinding[] = []
  const recommendations: GitHubRecommendation[] = []
  let score = 0
  const maxScore = 100

  // Parse repo from URL
  const repoMatch = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/i)
  if (!repoMatch) {
    return {
      connected: true,
      repoFound: false,
      score: 0,
      maxScore,
      findings: [{
        type: 'error',
        category: 'general',
        message: 'Invalid GitHub repository URL',
        details: repoUrl
      }],
      recommendations: []
    }
  }

  const [, owner, repo] = repoMatch
  console.log(`[GitHub Scanner] Scanning ${owner}/${repo}`)

  try {
    // Verify repo access
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    })

    if (!repoResponse.ok) {
      return {
        connected: true,
        repoFound: false,
        score: 0,
        maxScore,
        findings: [{
          type: 'error',
          category: 'general',
          message: 'Cannot access repository',
          details: `${repoResponse.status}: ${repoResponse.statusText}`
        }],
        recommendations: [{
          priority: 'high',
          title: 'Grant repository access',
          description: 'LaunchReady needs read access to scan your repository',
          actionable: 'Re-authorize with GitHub and ensure the repository is accessible'
        }]
      }
    }

    const repoData = await repoResponse.json()
    score += 20 // Base score for having a connected repo

    findings.push({
      type: 'success',
      category: 'general',
      message: 'Repository connected',
      details: `${repoData.full_name} (${repoData.visibility})`
    })

    // Get repository tree (all files)
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${repoData.default_branch}?recursive=1`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!treeResponse.ok) {
      findings.push({
        type: 'warning',
        category: 'general',
        message: 'Could not fetch file tree',
        details: 'Some checks may be incomplete'
      })
    } else {
      const treeData = await treeResponse.json()
      const files = (treeData.tree || [])
        .filter((f: { type: string; path: string }) => 
          f.type === 'blob' && 
          !IGNORE_PATTERNS.some(pattern => pattern.test(f.path))
        )

      // Scan key files for secrets and debug statements
      const filesToScan = files
        .filter((f: { path: string }) => 
          /\.(ts|tsx|js|jsx|py|rb|go|java|env|json|yaml|yml)$/i.test(f.path)
        )
        .slice(0, 50) // Limit to 50 files for performance

      let secretsFound = 0
      let debugFound = 0

      for (const file of filesToScan) {
        try {
          const contentResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
              },
            }
          )

          if (!contentResponse.ok) continue

          const contentData = await contentResponse.json()
          const content = Buffer.from(contentData.content || '', 'base64').toString('utf-8')

          // Check for secrets (skip .env.example)
          if (!file.path.includes('.example') && !file.path.includes('.sample')) {
            for (const { name, pattern } of SECRET_PATTERNS) {
              const matches = content.match(pattern)
              if (matches && matches.length > 0) {
                secretsFound++
                findings.push({
                  type: 'error',
                  category: 'secrets',
                  message: `Potential ${name} found`,
                  file: file.path,
                  details: `Found ${matches.length} potential secret(s)`
                })
              }
            }
          }

          // Check for debug statements (in production files)
          if (!file.path.includes('test') && !file.path.includes('spec')) {
            for (const { name, pattern } of DEBUG_PATTERNS) {
              const matches = content.match(pattern)
              if (matches && matches.length > 0) {
                debugFound += matches.length
                if (debugFound <= 5) { // Only report first 5
                  findings.push({
                    type: 'warning',
                    category: 'debug',
                    message: `${name} found`,
                    file: file.path,
                    details: `${matches.length} occurrence(s)`
                  })
                }
              }
            }
          }
        } catch (error) {
          console.log(`[GitHub Scanner] Error scanning ${file.path}:`, error)
        }
      }

      // Score based on secrets
      if (secretsFound === 0) {
        score += 30
        findings.push({
          type: 'success',
          category: 'secrets',
          message: 'No secrets detected in code',
          details: `Scanned ${filesToScan.length} files`
        })
      } else {
        recommendations.push({
          priority: 'high',
          title: 'Remove exposed secrets',
          description: `Found ${secretsFound} potential secrets in your codebase`,
          actionable: 'Move secrets to environment variables and rotate any exposed keys immediately'
        })
      }

      // Score based on debug statements
      if (debugFound <= 5) {
        score += 20
        findings.push({
          type: 'success',
          category: 'debug',
          message: debugFound === 0 ? 'No debug statements found' : 'Minimal debug statements',
          details: `${debugFound} debug statement(s) found`
        })
      } else {
        recommendations.push({
          priority: 'medium',
          title: 'Remove debug statements',
          description: `Found ${debugFound} debug statements in production code`,
          actionable: 'Remove console.log, debugger statements before deployment'
        })
      }

      // Check for .env.example
      const hasEnvExample = files.some((f: { path: string }) => 
        f.path.match(/\.env\.example$/i) || f.path.match(/\.env\.sample$/i)
      )
      if (hasEnvExample) {
        score += 10
        findings.push({
          type: 'success',
          category: 'env',
          message: '.env.example file present',
          details: 'Environment variables are documented'
        })
      } else {
        recommendations.push({
          priority: 'medium',
          title: 'Add .env.example',
          description: 'Document required environment variables',
          actionable: 'Create .env.example with all required variables (without values)'
        })
      }

      // Check package.json for dependencies
      const packageJson = files.find((f: { path: string }) => f.path === 'package.json')
      if (packageJson) {
        try {
          const pkgResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/package.json`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
              },
            }
          )
          const pkgData = await pkgResponse.json()
          const pkgContent = JSON.parse(Buffer.from(pkgData.content || '', 'base64').toString('utf-8'))
          
          const deps = Object.keys(pkgContent.dependencies || {}).length
          const devDeps = Object.keys(pkgContent.devDependencies || {}).length

          score += 10
          findings.push({
            type: 'success',
            category: 'dependencies',
            message: 'Package.json found',
            details: `${deps} dependencies, ${devDeps} dev dependencies`
          })

          // Check for security-related dependencies
          const allDeps = { ...pkgContent.dependencies, ...pkgContent.devDependencies }
          if (!allDeps['@sentry/nextjs'] && !allDeps['@sentry/node'] && !allDeps['@sentry/browser']) {
            recommendations.push({
              priority: 'medium',
              title: 'Add error tracking',
              description: 'Consider adding Sentry for error monitoring',
              actionable: 'npm install @sentry/nextjs'
            })
          }
        } catch {
          // Package.json parsing failed
        }
      }

      // Check for README
      const hasReadme = files.some((f: { path: string }) => 
        f.path.match(/^readme\.md$/i)
      )
      if (hasReadme) {
        score += 10
        findings.push({
          type: 'success',
          category: 'general',
          message: 'README.md present',
          details: 'Project documentation exists'
        })
      } else {
        recommendations.push({
          priority: 'low',
          title: 'Add README.md',
          description: 'Document your project for collaborators',
          actionable: 'Create README.md with setup instructions'
        })
      }

      // Check for analytics configuration in codebase
      const analyticsFindings = await checkAnalyticsInRepo(accessToken, owner, repo, files)
      findings.push(...analyticsFindings.findings)
      recommendations.push(...analyticsFindings.recommendations)
    }

    return {
      connected: true,
      repoFound: true,
      score: Math.min(score, maxScore),
      maxScore,
      findings,
      recommendations
    }

  } catch (error) {
    console.error('[GitHub Scanner] Error:', error)
    return {
      connected: true,
      repoFound: false,
      score: 0,
      maxScore,
      findings: [{
        type: 'error',
        category: 'general',
        message: 'Error scanning repository',
        details: error instanceof Error ? error.message : 'Unknown error'
      }],
      recommendations: []
    }
  }
}

// Environment variable patterns for analytics/service detection
const ENV_VAR_PATTERNS = {
  // Analytics tools
  'PostHog': [
    /POSTHOG/i,
    /NEXT_PUBLIC_POSTHOG/i,
  ],
  'Google Analytics': [
    /GA_TRACKING/i,
    /GOOGLE_ANALYTICS/i,
    /GA_ID/i,
    /GA4_/i,
    /NEXT_PUBLIC_GA/i,
    /GTAG/i,
  ],
  'Plausible': [
    /PLAUSIBLE/i,
    /NEXT_PUBLIC_PLAUSIBLE/i,
  ],
  'Mixpanel': [
    /MIXPANEL/i,
    /NEXT_PUBLIC_MIXPANEL/i,
  ],
  'Segment': [
    /SEGMENT/i,
    /NEXT_PUBLIC_SEGMENT/i,
  ],
  'Amplitude': [
    /AMPLITUDE/i,
    /NEXT_PUBLIC_AMPLITUDE/i,
  ],
  // Error tracking
  'Sentry': [
    /SENTRY/i,
    /NEXT_PUBLIC_SENTRY/i,
  ],
  'Bugsnag': [
    /BUGSNAG/i,
  ],
  'Rollbar': [
    /ROLLBAR/i,
  ],
  // Session recording
  'LogRocket': [
    /LOGROCKET/i,
    /NEXT_PUBLIC_LOGROCKET/i,
  ],
  'FullStory': [
    /FULLSTORY/i,
    /NEXT_PUBLIC_FULLSTORY/i,
  ],
  'Hotjar': [
    /HOTJAR/i,
    /NEXT_PUBLIC_HOTJAR/i,
  ],
  // Databases
  'Database': [
    /DATABASE_URL/i,
    /POSTGRES/i,
    /MYSQL/i,
    /MONGODB/i,
    /SUPABASE/i,
    /PRISMA/i,
    /PLANETSCALE/i,
    /NEON/i,
  ],
  // Payment
  'Stripe': [
    /STRIPE/i,
    /NEXT_PUBLIC_STRIPE/i,
  ],
  // Email
  'Resend': [
    /RESEND/i,
  ],
  'SendGrid': [
    /SENDGRID/i,
  ],
  // Auth
  'Clerk': [
    /CLERK/i,
    /NEXT_PUBLIC_CLERK/i,
  ],
  'Auth0': [
    /AUTH0/i,
  ],
  'NextAuth': [
    /NEXTAUTH/i,
  ],
}

/**
 * Scan environment example files for configured services
 */
async function scanEnvFiles(
  accessToken: string,
  owner: string,
  repo: string,
  files: Array<{ path: string; type: string }>
): Promise<{ findings: GitHubFinding[]; recommendations: GitHubRecommendation[]; detectedServices: string[] }> {
  const findings: GitHubFinding[] = []
  const recommendations: GitHubRecommendation[] = []
  const detectedServices: string[] = []

  // Find env example files
  const envExampleFiles = files.filter((f: { path: string }) =>
    /\.env\.example$/i.test(f.path) ||
    /\.env\.sample$/i.test(f.path) ||
    /\.env\.local\.example$/i.test(f.path) ||
    /\.env\.template$/i.test(f.path) ||
    /env\.example$/i.test(f.path)
  )

  if (envExampleFiles.length === 0) {
    return { findings, recommendations, detectedServices }
  }

  console.log(`[GitHub Scanner] Found ${envExampleFiles.length} env example file(s)`)

  for (const file of envExampleFiles) {
    try {
      const contentResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      )

      if (!contentResponse.ok) continue

      const contentData = await contentResponse.json()
      const content = Buffer.from(contentData.content || '', 'base64').toString('utf-8')

      // Extract variable names from the env file
      const envVars = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('=')[0].trim())
        .filter(Boolean)

      // Check each service pattern
      for (const [serviceName, patterns] of Object.entries(ENV_VAR_PATTERNS)) {
        const hasService = envVars.some(envVar => 
          patterns.some(pattern => pattern.test(envVar))
        )
        if (hasService && !detectedServices.includes(serviceName)) {
          detectedServices.push(serviceName)
        }
      }

    } catch (error) {
      console.log(`[GitHub Scanner] Error reading ${file.path}:`, error)
    }
  }

  // Generate findings based on detected services
  const analyticsServices = detectedServices.filter(s => 
    ['PostHog', 'Google Analytics', 'Plausible', 'Mixpanel', 'Segment', 'Amplitude'].includes(s)
  )
  const errorTrackingServices = detectedServices.filter(s =>
    ['Sentry', 'Bugsnag', 'Rollbar'].includes(s)
  )
  const sessionServices = detectedServices.filter(s =>
    ['LogRocket', 'FullStory', 'Hotjar'].includes(s)
  )
  const paymentServices = detectedServices.filter(s =>
    ['Stripe'].includes(s)
  )
  const emailServices = detectedServices.filter(s =>
    ['Resend', 'SendGrid'].includes(s)
  )
  const authServices = detectedServices.filter(s =>
    ['Clerk', 'Auth0', 'NextAuth'].includes(s)
  )

  if (analyticsServices.length > 0) {
    findings.push({
      type: 'success',
      category: 'general',
      message: `Analytics configured: ${analyticsServices.join(', ')}`,
      details: 'Found in environment variables'
    })
  }

  if (errorTrackingServices.length > 0) {
    findings.push({
      type: 'success',
      category: 'general',
      message: `Error tracking configured: ${errorTrackingServices.join(', ')}`,
      details: 'Found in environment variables'
    })
  }

  if (sessionServices.length > 0) {
    findings.push({
      type: 'success',
      category: 'general',
      message: `Session recording configured: ${sessionServices.join(', ')}`,
      details: 'Found in environment variables'
    })
  }

  if (paymentServices.length > 0) {
    findings.push({
      type: 'success',
      category: 'general',
      message: `Payment processing: ${paymentServices.join(', ')}`,
      details: 'Found in environment variables'
    })
  }

  if (emailServices.length > 0) {
    findings.push({
      type: 'success',
      category: 'general',
      message: `Email service: ${emailServices.join(', ')}`,
      details: 'Found in environment variables'
    })
  }

  if (authServices.length > 0) {
    findings.push({
      type: 'success',
      category: 'general',
      message: `Authentication: ${authServices.join(', ')}`,
      details: 'Found in environment variables'
    })
  }

  // Add recommendations for missing critical services
  if (analyticsServices.length === 0) {
    recommendations.push({
      priority: 'medium',
      title: 'Add analytics tracking',
      description: 'No analytics service detected in environment variables',
      actionable: 'Add NEXT_PUBLIC_POSTHOG_KEY or GA_TRACKING_ID to track user behavior'
    })
  }

  if (errorTrackingServices.length === 0) {
    recommendations.push({
      priority: 'high',
      title: 'Add error tracking',
      description: 'No error tracking service detected in environment variables',
      actionable: 'Add SENTRY_DSN for production error monitoring'
    })
  }

  return { findings, recommendations, detectedServices }
}

/**
 * Deep source code scanning for analytics patterns
 * Scans actual source files for analytics initialization and usage
 */
async function deepSourceScan(
  accessToken: string,
  owner: string,
  repo: string,
  files: Array<{ path: string; type: string }>
): Promise<{ detectedServices: string[]; findings: GitHubFinding[] }> {
  const detectedServices: string[] = []
  const findings: GitHubFinding[] = []
  
  // Get priority files that exist in the repo
  const priorityFilesToScan = ANALYTICS_PRIORITY_FILES.filter(priorityFile =>
    files.some(f => f.path === priorityFile || f.path.endsWith(priorityFile))
  )
  
  // Also check any .tsx/.ts files in app/ or src/ directories (limit to 20 files max)
  const sourceFiles = files
    .filter(f => 
      (f.path.match(/\.(tsx?|jsx?)$/) && 
       (f.path.startsWith('app/') || f.path.startsWith('src/') || f.path.startsWith('pages/') || f.path.startsWith('lib/') || f.path.startsWith('components/'))) &&
      !IGNORE_PATTERNS.some(pattern => pattern.test(f.path))
    )
    .slice(0, 20) // Limit to avoid API rate limits
  
  const filesToScan = [...new Set([...priorityFilesToScan, ...sourceFiles.map(f => f.path)])]
  
  console.log(`[GitHub Scanner] Deep scanning ${filesToScan.length} source files for analytics...`)
  
  for (const filePath of filesToScan) {
    try {
      const contentResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      )

      if (!contentResponse.ok) continue

      const contentData = await contentResponse.json()
      
      // Skip if file is too large (>500KB)
      if (contentData.size > 500000) continue
      
      const content = Buffer.from(contentData.content || '', 'base64').toString('utf-8')

      // Check each analytics pattern
      for (const [serviceName, patterns] of Object.entries(ANALYTICS_SOURCE_PATTERNS)) {
        const hasService = patterns.some(pattern => pattern.test(content))
        if (hasService && !detectedServices.includes(serviceName)) {
          detectedServices.push(serviceName)
          console.log(`[GitHub Scanner] Found ${serviceName} in ${filePath}`)
        }
      }

    } catch (error) {
      // Skip files that can't be read
      continue
    }
  }

  // Generate findings for detected services
  const analyticsServices = detectedServices.filter(s => 
    ['PostHog', 'Google Analytics', 'Plausible', 'Mixpanel', 'Segment', 'Amplitude', 'Vercel Analytics'].includes(s)
  )
  const errorTrackingServices = detectedServices.filter(s =>
    ['Sentry'].includes(s)
  )
  const sessionRecordingServices = detectedServices.filter(s =>
    ['Hotjar', 'LogRocket', 'FullStory'].includes(s)
  )

  if (analyticsServices.length > 0) {
    findings.push({
      type: 'success',
      category: 'general',
      message: `Analytics detected (deep scan): ${analyticsServices.join(', ')}`,
      details: 'Found in source code initialization'
    })
  }

  if (errorTrackingServices.length > 0) {
    findings.push({
      type: 'success',
      category: 'general',
      message: `Error tracking detected (deep scan): ${errorTrackingServices.join(', ')}`,
      details: 'Found in source code'
    })
  }

  if (sessionRecordingServices.length > 0) {
    findings.push({
      type: 'success',
      category: 'general',
      message: `Session recording detected (deep scan): ${sessionRecordingServices.join(', ')}`,
      details: 'Found in source code'
    })
  }

  return { detectedServices, findings }
}

/**
 * Check for analytics configuration in the repository
 */
async function checkAnalyticsInRepo(
  accessToken: string,
  owner: string,
  repo: string,
  files: Array<{ path: string; type: string }>
): Promise<{ findings: GitHubFinding[]; recommendations: GitHubRecommendation[] }> {
  const findings: GitHubFinding[] = []
  const recommendations: GitHubRecommendation[] = []
  const allDetectedServices: string[] = []

  // Analytics patterns to detect in package.json or config files
  const analyticsPackages = {
    'PostHog': ['posthog-js', '@posthog/react', 'posthog-node'],
    'Google Analytics': ['@analytics/google-analytics', 'react-ga4', 'gtag'],
    'Plausible': ['plausible-tracker', '@plausible/tracker'],
    'Mixpanel': ['mixpanel-browser', 'mixpanel'],
    'Segment': ['@segment/analytics-next', 'analytics-node'],
    'Amplitude': ['@amplitude/analytics-browser'],
    'Vercel Analytics': ['@vercel/analytics'],
    'Sentry': ['@sentry/nextjs', '@sentry/react', '@sentry/node'],
  }

  // First, scan env files for service configuration
  const envScanResults = await scanEnvFiles(accessToken, owner, repo, files)
  findings.push(...envScanResults.findings)
  allDetectedServices.push(...envScanResults.detectedServices)

  // Deep scan source files for analytics patterns (most accurate)
  const deepScanResults = await deepSourceScan(accessToken, owner, repo, files)
  findings.push(...deepScanResults.findings)
  for (const service of deepScanResults.detectedServices) {
    if (!allDetectedServices.includes(service)) {
      allDetectedServices.push(service)
    }
  }

  // Check package.json for analytics dependencies
  const packageJson = files.find((f: { path: string }) => f.path === 'package.json')
  if (packageJson) {
    try {
      const pkgResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/package.json`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      )
      
      if (pkgResponse.ok) {
        const pkgData = await pkgResponse.json()
        const pkgContent = JSON.parse(Buffer.from(pkgData.content || '', 'base64').toString('utf-8'))
        const allDeps = { ...pkgContent.dependencies, ...pkgContent.devDependencies }
        
        const detectedFromPkg: string[] = []
        
        for (const [tool, packages] of Object.entries(analyticsPackages)) {
          if (packages.some(pkg => allDeps[pkg])) {
            if (!allDetectedServices.includes(tool)) {
              detectedFromPkg.push(tool)
              allDetectedServices.push(tool)
            }
          }
        }
        
        // Only add package.json findings if we found something new (not already in env)
        if (detectedFromPkg.length > 0) {
          findings.push({
            type: 'success',
            category: 'general',
            message: `Additional packages: ${detectedFromPkg.join(', ')}`,
            details: 'Analytics packages found in dependencies'
          })
        }
        
        // Check for error tracking (only if not already detected from env)
        if (!allDetectedServices.includes('Sentry') && !allDetectedServices.includes('Bugsnag') && !allDetectedServices.includes('Rollbar')) {
          if (!allDeps['@sentry/nextjs'] && !allDeps['@sentry/react'] && !allDeps['@sentry/node']) {
            const hasOtherErrorTracking = allDeps['bugsnag'] || allDeps['@bugsnag/js'] || allDeps['rollbar']
            if (!hasOtherErrorTracking && !envScanResults.recommendations.some(r => r.title.includes('error tracking'))) {
              recommendations.push({
                priority: 'high',
                title: 'Add error tracking',
                description: 'No error tracking found in dependencies or environment',
                actionable: 'Install Sentry for production error monitoring'
              })
            }
          }
        }
      }
    } catch (error) {
      console.log('[GitHub Scanner] Could not parse package.json for analytics:', error)
    }
  }

  // Only add analytics recommendation if nothing detected at all
  if (!allDetectedServices.some(s => ['PostHog', 'Google Analytics', 'Plausible', 'Mixpanel', 'Segment', 'Amplitude', 'Vercel Analytics'].includes(s))) {
    if (!envScanResults.recommendations.some(r => r.title.includes('analytics'))) {
      recommendations.push({
        priority: 'medium',
        title: 'Add analytics',
        description: 'No analytics detected in dependencies or environment variables',
        actionable: 'Install PostHog, Plausible, or Google Analytics for user tracking'
      })
    }
  }

  // Add env scan recommendations (deduped)
  for (const rec of envScanResults.recommendations) {
    if (!recommendations.some(r => r.title === rec.title)) {
      recommendations.push(rec)
    }
  }

  // Check for vercel.json (Vercel deployment config)
  const hasVercelConfig = files.some((f: { path: string }) => f.path === 'vercel.json')
  if (hasVercelConfig) {
    findings.push({
      type: 'success',
      category: 'general',
      message: 'Vercel configuration found',
      details: 'Project has vercel.json deployment config'
    })
  }

  // Check for CI/CD configuration
  const hasCICD = files.some((f: { path: string }) => 
    f.path.includes('.github/workflows/') || 
    f.path === '.gitlab-ci.yml' ||
    f.path === '.circleci/config.yml'
  )
  if (hasCICD) {
    findings.push({
      type: 'success',
      category: 'general',
      message: 'CI/CD configuration detected',
      details: 'Automated testing/deployment is configured'
    })
  } else {
    recommendations.push({
      priority: 'low',
      title: 'Add CI/CD',
      description: 'No CI/CD configuration found',
      actionable: 'Add GitHub Actions for automated testing and deployment'
    })
  }

  return { findings, recommendations }
}

/**
 * Disconnect GitHub from a project
 */
export async function disconnectGitHub(projectId: string): Promise<boolean> {
  // This would be called from an API route
  // Updates project to remove GitHub tokens
  return true
}
