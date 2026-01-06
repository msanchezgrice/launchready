import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { scanProject, ScanPhaseResult } from '@/lib/scanner'
import { scanGitHubRepo, GitHubScanResult } from '@/lib/github-scanner'
import { runVisualScan } from '@/lib/visual-scanner'
import { canScan, getPlanLimits } from '@/lib/stripe'
import { isRedisConfigured } from '@/lib/redis'
import { addScanJob } from '@/lib/scan-queue'

type Params = Promise<{ id: string }>

// POST /api/projects/[id]/scan - Trigger project scan
// Query params:
//   - async=true: Queue the scan for background processing (requires Redis)
export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await currentUser()
    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)
    const useQueue = searchParams.get('async') === 'true'

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify project ownership and get user's GitHub token
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: dbUser.id,
      },
      include: {
        scans: {
          orderBy: { scannedAt: 'desc' },
          take: 1,
        },
        user: {
          select: {
            githubAccessToken: true,
            githubUsername: true,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check rate limiting based on plan
    const userCanScan = canScan(dbUser.plan, dbUser.lastScan)
    const limits = getPlanLimits(dbUser.plan)

    if (!userCanScan && limits.scansPerDay !== -1) {
      const nextScanTime = dbUser.lastScan
        ? new Date(dbUser.lastScan.getTime() + 24 * 60 * 60 * 1000)
        : new Date()
      
      const hoursRemaining = Math.max(
        0,
        Math.ceil((nextScanTime.getTime() - Date.now()) / (1000 * 60 * 60))
      )

      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `${dbUser.plan === 'free' ? 'Free tier' : 'Your plan'}: ${limits.scansPerDay} scan${limits.scansPerDay === 1 ? '' : 's'} per day. Next scan available in ${hoursRemaining} hours.`,
          upgrade: true,
          nextScanAt: nextScanTime.toISOString(),
        },
        { status: 429 }
      )
    }

    // Queue-based async scanning (if enabled and Redis is configured)
    if (useQueue) {
      if (!isRedisConfigured()) {
        return NextResponse.json(
          { 
            error: 'Queue not available',
            message: 'Async scanning requires Redis. Falling back to sync scan.',
            fallback: true,
          },
          { status: 503 }
        )
      }

      // Add job to queue (include GitHub info if available)
      const job = await addScanJob({
        projectId: project.id,
        projectName: project.name,
        url: project.url,
        userId: dbUser.id,
        trigger: 'manual',
        // Pass GitHub info for automatic GitHub scanning
        githubRepo: project.githubRepo || undefined,
        githubAccessToken: project.user.githubAccessToken || undefined,
      })

      // Update user's lastScan timestamp (reserve the slot)
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { lastScan: new Date() },
      })

      return NextResponse.json({
        queued: true,
        jobId: job.id,
        message: 'Scan queued successfully',
        project: {
          id: project.id,
          name: project.name,
          url: project.url,
        },
      })
    }

    // Synchronous scan (default)
    const scanResult = await scanProject(project.url)

    // Automatically run GitHub scan if repo is configured and GitHub is connected
    let githubScanResult: GitHubScanResult | null = null
    if (project.githubRepo && project.user.githubAccessToken) {
      console.log(`[Scan] Running automatic GitHub scan for ${project.githubRepo}`)
      try {
        githubScanResult = await scanGitHubRepo(
          project.user.githubAccessToken,
          project.githubRepo
        )
        console.log(`[Scan] GitHub scan complete: ${githubScanResult.score}/${githubScanResult.maxScore}`)
      } catch (error) {
        console.error('[Scan] GitHub scan failed (continuing with URL scan):', error)
        // Don't fail the whole scan if GitHub scan fails
      }
    }

    // Run visual scan (screenshots, mobile responsiveness)
    // Must await this or Vercel will terminate the function before it completes
    let visualScanResult: { desktopUrl?: string; mobileUrl?: string; metrics?: object; findings?: object[]; recommendations?: object[] } | null = null
    console.log(`[Scan] Starting visual scan for ${project.url}`)
    try {
      const result = await runVisualScan(project.url)
      if (result.success) {
        console.log(`[Scan] Visual scan complete!`)
        visualScanResult = {
          desktopUrl: result.screenshots.desktopUrl,
          mobileUrl: result.screenshots.mobileUrl,
          metrics: result.metrics,
          findings: result.findings,
          recommendations: result.recommendations,
        }
      } else {
        console.log(`[Scan] Visual scan failed: ${result.error}`)
      }
    } catch (error) {
      console.error('[Scan] Visual scan error:', error)
    }

    // Build metadata object
    const metadata: Record<string, unknown> = {}
    if (githubScanResult) {
      metadata.githubScan = {
        score: githubScanResult.score,
        maxScore: githubScanResult.maxScore,
        findings: githubScanResult.findings,
        recommendations: githubScanResult.recommendations,
        repoFound: githubScanResult.repoFound,
      }
    }
    if (visualScanResult) {
      metadata.visualScan = {
        success: true,
        hasDesktopScreenshot: !!visualScanResult.desktopUrl,
        hasMobileScreenshot: !!visualScanResult.mobileUrl,
        desktopScreenshotUrl: visualScanResult.desktopUrl,
        mobileScreenshotUrl: visualScanResult.mobileUrl,
        findings: visualScanResult.findings,
        recommendations: visualScanResult.recommendations,
        metrics: visualScanResult.metrics,
      }
    }

    // Enhance phase scores based on GitHub scan findings
    // This merges GitHub-detected analytics into the Analytics phase
    const enhancedPhases = scanResult.phases.map((phase: ScanPhaseResult) => {
      if (phase.phaseName === 'Analytics' && githubScanResult) {
        // Check if GitHub found analytics that weren't detected in the live page
        const githubAnalyticsFindings = githubScanResult.findings.filter(
          (f: { message: string }) => 
            f.message.toLowerCase().includes('analytics') ||
            f.message.toLowerCase().includes('posthog') ||
            f.message.toLowerCase().includes('google analytics') ||
            f.message.toLowerCase().includes('plausible') ||
            f.message.toLowerCase().includes('mixpanel') ||
            f.message.toLowerCase().includes('segment') ||
            f.message.toLowerCase().includes('amplitude')
        )
        
        if (githubAnalyticsFindings.length > 0 && phase.score < 50) {
          // Boost the analytics score if GitHub found analytics but page scan didn't
          const boost = Math.min(40, githubAnalyticsFindings.length * 20)
          const newScore = Math.min(phase.maxScore, phase.score + boost)
          
          return {
            ...phase,
            score: newScore,
            findings: [
              ...phase.findings,
              ...githubAnalyticsFindings.map((f: { message: string; details?: string }) => ({
                type: 'success' as const,
                message: `GitHub: ${f.message}`,
                details: f.details || 'Detected in source code'
              }))
            ]
          }
        }
      }
      
      // Also enhance Monitoring phase with GitHub error tracking findings
      if (phase.phaseName === 'Monitoring' && githubScanResult) {
        const githubMonitoringFindings = githubScanResult.findings.filter(
          (f: { message: string }) => 
            f.message.toLowerCase().includes('error tracking') ||
            f.message.toLowerCase().includes('sentry') ||
            f.message.toLowerCase().includes('bugsnag') ||
            f.message.toLowerCase().includes('logrocket') ||
            f.message.toLowerCase().includes('session recording')
        )
        
        if (githubMonitoringFindings.length > 0 && phase.score < 50) {
          const boost = Math.min(40, githubMonitoringFindings.length * 20)
          const newScore = Math.min(phase.maxScore, phase.score + boost)
          
          return {
            ...phase,
            score: newScore,
            findings: [
              ...phase.findings,
              ...githubMonitoringFindings.map((f: { message: string; details?: string }) => ({
                type: 'success' as const,
                message: `GitHub: ${f.message}`,
                details: f.details || 'Detected in source code'
              }))
            ]
          }
        }
      }
      
      return phase
    })

    // Recalculate total score
    const totalScore = enhancedPhases.reduce((sum: number, phase: ScanPhaseResult) => sum + phase.score, 0)
    const maxScore = enhancedPhases.reduce((sum: number, phase: ScanPhaseResult) => sum + phase.maxScore, 0)
    const enhancedScore = Math.round((totalScore / maxScore) * 100)

    // Save scan results to database
    const scan = await prisma.scan.create({
      data: {
        projectId: project.id,
        score: enhancedScore,
        trigger: 'manual',
        metadata: Object.keys(metadata).length > 0 
          ? JSON.parse(JSON.stringify(metadata)) 
          : undefined,
        phases: {
          create: enhancedPhases.map((phase: ScanPhaseResult) => ({
            phaseName: phase.phaseName,
            score: phase.score,
            maxScore: phase.maxScore,
            findings: phase.findings as object,
            recommendations: (phase.recommendations || []) as object[],
          })),
        },
      },
      include: {
        phases: true,
      },
    })


    // Update user's lastScan timestamp
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { lastScan: new Date() },
    })

    return NextResponse.json({
      scan,
      githubScan: githubScanResult,
      visualScan: visualScanResult,
      message: 'Scan completed successfully.',
    })
  } catch (error) {
    console.error('Error scanning project:', error)
    return NextResponse.json(
      { error: 'Failed to scan project', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
