/**
 * Vercel Project Scanner
 * Analyzes Vercel deployment configuration, environment variables, and settings
 */

export interface VercelScanResult {
  connected: boolean
  projectFound: boolean
  score: number
  maxScore: number
  findings: VercelFinding[]
  recommendations: VercelRecommendation[]
}

export interface VercelFinding {
  type: 'success' | 'warning' | 'error'
  category: 'deployment' | 'env' | 'domain' | 'performance' | 'general'
  message: string
  details?: string
}

export interface VercelRecommendation {
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  actionable: string
}

/**
 * Scan a Vercel project for configuration issues
 */
export async function scanVercelProject(
  accessToken: string,
  projectName: string,
  teamId?: string | null
): Promise<VercelScanResult> {
  const findings: VercelFinding[] = []
  const recommendations: VercelRecommendation[] = []
  let score = 0
  const maxScore = 100

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }

  console.log(`[Vercel Scanner] Scanning project: ${projectName}`)

  try {
    // Get project info
    const projectUrl = teamId 
      ? `https://api.vercel.com/v9/projects/${projectName}?teamId=${teamId}`
      : `https://api.vercel.com/v9/projects/${projectName}`

    const projectResponse = await fetch(projectUrl, { headers })

    if (!projectResponse.ok) {
      return {
        connected: true,
        projectFound: false,
        score: 0,
        maxScore,
        findings: [{
          type: 'error',
          category: 'general',
          message: 'Cannot access Vercel project',
          details: `${projectResponse.status}: ${projectResponse.statusText}`
        }],
        recommendations: [{
          priority: 'high',
          title: 'Grant project access',
          description: 'LaunchReady needs access to scan your Vercel project',
          actionable: 'Re-authorize with Vercel and ensure the project is accessible'
        }]
      }
    }

    const projectData = await projectResponse.json()
    score += 20 // Base score for connected project

    findings.push({
      type: 'success',
      category: 'general',
      message: 'Vercel project connected',
      details: projectData.name
    })

    // Check framework
    if (projectData.framework) {
      score += 10
      findings.push({
        type: 'success',
        category: 'general',
        message: `Framework: ${projectData.framework}`,
        details: 'Framework detected for optimized builds'
      })
    }

    // Check environment variables
    const envUrl = teamId
      ? `https://api.vercel.com/v9/projects/${projectName}/env?teamId=${teamId}`
      : `https://api.vercel.com/v9/projects/${projectName}/env`

    const envResponse = await fetch(envUrl, { headers })
    
    if (envResponse.ok) {
      const envData = await envResponse.json()
      const envVars = envData.envs || []
      
      if (envVars.length > 0) {
        score += 15
        findings.push({
          type: 'success',
          category: 'env',
          message: `${envVars.length} environment variables configured`,
          details: 'Environment variables are set up'
        })

        // Check for production vs preview/development
        const productionVars = envVars.filter((e: { target: string[] }) => 
          e.target?.includes('production')
        )
        const previewVars = envVars.filter((e: { target: string[] }) => 
          e.target?.includes('preview')
        )

        if (productionVars.length > 0 && previewVars.length > 0) {
          score += 5
          findings.push({
            type: 'success',
            category: 'env',
            message: 'Environment separation',
            details: `${productionVars.length} production, ${previewVars.length} preview vars`
          })
        } else if (productionVars.length === 0) {
          recommendations.push({
            priority: 'medium',
            title: 'Set production environment variables',
            description: 'No production-specific variables detected',
            actionable: 'Add environment variables targeting production in Vercel dashboard'
          })
        }

        // Check for common required vars
        const varKeys = envVars.map((e: { key: string }) => e.key.toLowerCase())
        const hasDatabase = varKeys.some((k: string) => 
          k.includes('database') || k.includes('postgres') || k.includes('mysql')
        )
        const hasAuth = varKeys.some((k: string) => 
          k.includes('auth') || k.includes('clerk') || k.includes('nextauth')
        )

        if (hasDatabase) {
          score += 5
          findings.push({
            type: 'success',
            category: 'env',
            message: 'Database configuration detected'
          })
        }
        if (hasAuth) {
          score += 5
          findings.push({
            type: 'success',
            category: 'env',
            message: 'Authentication configuration detected'
          })
        }
      } else {
        findings.push({
          type: 'warning',
          category: 'env',
          message: 'No environment variables configured',
          details: 'Your app may need configuration'
        })
        recommendations.push({
          priority: 'medium',
          title: 'Configure environment variables',
          description: 'Most apps need environment variables for API keys, database URLs, etc.',
          actionable: 'Add environment variables in Vercel project settings'
        })
      }
    }

    // Check domains
    const domainsUrl = teamId
      ? `https://api.vercel.com/v9/projects/${projectName}/domains?teamId=${teamId}`
      : `https://api.vercel.com/v9/projects/${projectName}/domains`

    const domainsResponse = await fetch(domainsUrl, { headers })
    
    if (domainsResponse.ok) {
      const domainsData = await domainsResponse.json()
      const domains = domainsData.domains || []
      
      const customDomains = domains.filter((d: { name: string }) => 
        !d.name.includes('.vercel.app')
      )
      
      if (customDomains.length > 0) {
        score += 15
        findings.push({
          type: 'success',
          category: 'domain',
          message: `${customDomains.length} custom domain(s) configured`,
          details: customDomains.map((d: { name: string }) => d.name).join(', ')
        })

        // Check domain verification
        const verifiedDomains = customDomains.filter((d: { verified: boolean }) => d.verified)
        if (verifiedDomains.length === customDomains.length) {
          score += 5
          findings.push({
            type: 'success',
            category: 'domain',
            message: 'All domains verified'
          })
        } else {
          recommendations.push({
            priority: 'high',
            title: 'Verify all domains',
            description: `${customDomains.length - verifiedDomains.length} domain(s) not verified`,
            actionable: 'Complete domain verification in Vercel dashboard'
          })
        }
      } else {
        findings.push({
          type: 'warning',
          category: 'domain',
          message: 'No custom domain configured',
          details: 'Using default vercel.app domain'
        })
        recommendations.push({
          priority: 'medium',
          title: 'Add custom domain',
          description: 'A custom domain improves brand credibility',
          actionable: 'Add a custom domain in Vercel project settings'
        })
      }
    }

    // Check latest deployment
    const deploymentsUrl = teamId
      ? `https://api.vercel.com/v6/deployments?projectId=${projectData.id}&teamId=${teamId}&limit=1`
      : `https://api.vercel.com/v6/deployments?projectId=${projectData.id}&limit=1`

    const deploymentsResponse = await fetch(deploymentsUrl, { headers })
    
    if (deploymentsResponse.ok) {
      const deploymentsData = await deploymentsResponse.json()
      const deployments = deploymentsData.deployments || []
      
      if (deployments.length > 0) {
        const latestDeployment = deployments[0]
        
        if (latestDeployment.state === 'READY') {
          score += 10
          findings.push({
            type: 'success',
            category: 'deployment',
            message: 'Latest deployment successful',
            details: `Deployed ${new Date(latestDeployment.created).toLocaleDateString()}`
          })
        } else if (latestDeployment.state === 'ERROR') {
          findings.push({
            type: 'error',
            category: 'deployment',
            message: 'Latest deployment failed',
            details: 'Check Vercel dashboard for error details'
          })
          recommendations.push({
            priority: 'high',
            title: 'Fix deployment errors',
            description: 'Your latest deployment failed',
            actionable: 'Check build logs in Vercel dashboard and fix the errors'
          })
        } else {
          findings.push({
            type: 'warning',
            category: 'deployment',
            message: `Deployment status: ${latestDeployment.state}`,
            details: 'Deployment may be in progress'
          })
        }

        // Check deployment source
        if (latestDeployment.source === 'git') {
          score += 5
          findings.push({
            type: 'success',
            category: 'deployment',
            message: 'Git-based deployments enabled',
            details: 'Auto-deploy on push is configured'
          })
        }
      }
    }

    // Check build settings
    if (projectData.buildCommand) {
      score += 5
      findings.push({
        type: 'success',
        category: 'deployment',
        message: 'Custom build command configured',
        details: projectData.buildCommand
      })
    }

    if (projectData.outputDirectory) {
      findings.push({
        type: 'success',
        category: 'deployment',
        message: 'Output directory configured',
        details: projectData.outputDirectory
      })
    }

    // General recommendations
    if (score < 50) {
      recommendations.push({
        priority: 'high',
        title: 'Complete Vercel setup',
        description: 'Your Vercel project needs additional configuration',
        actionable: 'Review Vercel project settings and add missing configuration'
      })
    }

    return {
      connected: true,
      projectFound: true,
      score: Math.min(score, maxScore),
      maxScore,
      findings,
      recommendations
    }

  } catch (error) {
    console.error('[Vercel Scanner] Error:', error)
    return {
      connected: true,
      projectFound: false,
      score: 0,
      maxScore,
      findings: [{
        type: 'error',
        category: 'general',
        message: 'Error scanning Vercel project',
        details: error instanceof Error ? error.message : 'Unknown error'
      }],
      recommendations: []
    }
  }
}
