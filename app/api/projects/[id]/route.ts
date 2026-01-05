import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

type Params = Promise<{ id: string }>

// GET /api/projects/[id] - Get project with all scans
export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await currentUser()
    const { id } = await params

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get project with all scans and phases
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: dbUser.id,
      },
      include: {
        scans: {
          orderBy: { scannedAt: 'desc' },
          include: {
            phases: true,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/projects/[id] - Update project
export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await currentUser()
    const { id } = await params

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
        id,
        userId: dbUser.id,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, url, githubRepo, vercelProject, autoScanEnabled, autoScanSchedule } = body

    // Check if auto-scan is a paid feature
    if (autoScanEnabled === true && dbUser.plan === 'free') {
      return NextResponse.json(
        { 
          error: 'Auto-scan requires Pro plan or higher',
          upgrade: true,
        },
        { status: 403 }
      )
    }

    // Validate auto-scan schedule
    const validSchedules = ['daily-6am', 'daily-12pm', 'daily-6pm', 'weekly-mon']
    if (autoScanSchedule && !validSchedules.includes(autoScanSchedule)) {
      return NextResponse.json(
        { error: 'Invalid auto-scan schedule' },
        { status: 400 }
      )
    }

    // Update project
    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(url && { url }),
        ...(githubRepo !== undefined && { githubRepo }),
        ...(vercelProject !== undefined && { vercelProject }),
        ...(typeof autoScanEnabled === 'boolean' && { autoScanEnabled }),
        ...(autoScanSchedule !== undefined && { 
          autoScanSchedule: autoScanSchedule || null 
        }),
      },
    })

    return NextResponse.json({ project: updatedProject })
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await currentUser()
    const { id } = await params

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
        id,
        userId: dbUser.id,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Delete project (cascade will delete related scans)
    await prisma.project.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
