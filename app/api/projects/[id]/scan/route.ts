import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { scanProject, ScanPhaseResult } from '@/lib/scanner'
import { scanGitHubRepo, GitHubScanResult } from '@/lib/github-scanner'
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

    // Save scan results to database
    const scan = await prisma.scan.create({
      data: {
        projectId: project.id,
        score: scanResult.score,
        trigger: 'manual',
        metadata: githubScanResult ? JSON.parse(JSON.stringify({
          githubScan: {
            score: githubScanResult.score,
            maxScore: githubScanResult.maxScore,
            findings: githubScanResult.findings,
            recommendations: githubScanResult.recommendations,
            repoFound: githubScanResult.repoFound,
          },
        })) : undefined,
        phases: {
          create: scanResult.phases.map((phase: ScanPhaseResult) => ({
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
      message: 'Scan completed successfully',
    })
  } catch (error) {
    console.error('Error scanning project:', error)
    return NextResponse.json(
      { error: 'Failed to scan project', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
