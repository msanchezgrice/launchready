import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getPlanLimits, canAddProject, canScan } from '@/lib/stripe'

// GET /api/projects - List user's projects
export async function GET() {
  try {
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find or create user in database
    let dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    })

    if (!dbUser) {
      // Create user if doesn't exist
      dbUser = await prisma.user.create({
        data: {
          clerkId: user.id,
          email: user.emailAddresses[0]?.emailAddress || '',
          name: user.fullName || user.firstName || null,
        },
      })
    }

    // Get user's projects with latest scan
    const projects = await prisma.project.findMany({
      where: { userId: dbUser.id },
      include: {
        scans: {
          orderBy: { scannedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get plan limits
    const limits = getPlanLimits(dbUser.plan)
    const projectCount = projects.length
    const userCanScan = canScan(dbUser.plan, dbUser.lastScan)
    
    // Calculate next scan time for rate-limited users
    let nextScanTime: string | undefined
    if (!userCanScan && dbUser.lastScan) {
      const nextScan = new Date(dbUser.lastScan.getTime() + 24 * 60 * 60 * 1000)
      nextScanTime = nextScan.toISOString()
    }

    // Build user plan info
    const userPlan = {
      plan: dbUser.plan,
      projectCount,
      maxProjects: limits.projects,
      canScan: userCanScan,
      nextScanTime,
      stripeCustomerId: dbUser.stripeCustomerId || undefined,
      subscriptionStatus: dbUser.subscriptionStatus || undefined,
    }

    return NextResponse.json({ projects, userPlan })
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects - Create new project
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, url } = body

    if (!name || !url) {
      return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 })
    }

    // Find or create user
    let dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    })

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          clerkId: user.id,
          email: user.emailAddresses[0]?.emailAddress || '',
          name: user.fullName || user.firstName || null,
        },
      })
    }

    // Check project limit based on plan
    const projectCount = await prisma.project.count({
      where: { userId: dbUser.id },
    })

    if (!canAddProject(dbUser.plan, projectCount)) {
      const limits = getPlanLimits(dbUser.plan)
      return NextResponse.json(
        {
          error: `Project limit reached (${projectCount}/${limits.projects})`,
          upgrade: true,
          currentCount: projectCount,
          maxProjects: limits.projects,
        },
        { status: 403 }
      )
    }

    // Create project
    const project = await prisma.project.create({
      data: {
        userId: dbUser.id,
        name,
        url,
      },
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
