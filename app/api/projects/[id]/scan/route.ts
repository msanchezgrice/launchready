import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { scanProject, ScanPhaseResult } from '@/lib/scanner'

type Params = Promise<{ id: string }>

// POST /api/projects/[id]/scan - Trigger project scan
export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await currentUser()
    const { id: projectId } = await params

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify project ownership
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
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check rate limiting for free tier (1 scan per day)
    if (dbUser.plan === 'free' && project.scans.length > 0) {
      const lastScan = project.scans[0]
      const hoursSinceLastScan =
        (Date.now() - new Date(lastScan.scannedAt).getTime()) / (1000 * 60 * 60)

      if (hoursSinceLastScan < 24) {
        const hoursRemaining = Math.ceil(24 - hoursSinceLastScan)
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: `Free tier: 1 scan per day. Next scan available in ${hoursRemaining} hours.`,
            upgrade: true,
            nextScanAt: new Date(
              new Date(lastScan.scannedAt).getTime() + 24 * 60 * 60 * 1000
            ).toISOString(),
          },
          { status: 429 }
        )
      }
    }

    // Run the scan
    const scanResult = await scanProject(project.url)

    // Save scan results to database
    const scan = await prisma.scan.create({
      data: {
        projectId: project.id,
        score: scanResult.score,
        trigger: 'manual',
        phases: {
          create: scanResult.phases.map((phase: ScanPhaseResult) => ({
            phaseName: phase.phaseName,
            score: phase.score,
            maxScore: phase.maxScore,
            findings: phase.findings as any,
            recommendations: (phase.recommendations || []) as any,
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
