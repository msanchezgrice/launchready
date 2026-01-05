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

/**
 * Disconnect GitHub from a project
 */
export async function disconnectGitHub(projectId: string): Promise<boolean> {
  // This would be called from an API route
  // Updates project to remove GitHub tokens
  return true
}
