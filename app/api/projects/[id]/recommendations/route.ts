/**
 * Recommendation Management API
 * GET: Get dismissed recommendations
 * POST: Mark a recommendation as done/dismissed
 * DELETE: Unmark a recommendation (restore it)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

type Params = Promise<{ id: string }>

// GET /api/projects/[id]/recommendations - Get dismissed recommendations
export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id: projectId } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project ownership
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
      },
      include: {
        dismissedRecommendations: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({
      dismissed: project.dismissedRecommendations.map((d) => d.recommendationKey),
    })
  } catch (error) {
    console.error('Error fetching dismissed recommendations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dismissed recommendations' },
      { status: 500 }
    )
  }
}

// POST /api/projects/[id]/recommendations - Mark recommendation as done
export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id: projectId } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { recommendationKey } = body

    if (!recommendationKey || typeof recommendationKey !== 'string') {
      return NextResponse.json(
        { error: 'Missing recommendationKey' },
        { status: 400 }
      )
    }

    // Verify project ownership
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Upsert the dismissed recommendation
    await prisma.dismissedRecommendation.upsert({
      where: {
        projectId_recommendationKey: {
          projectId,
          recommendationKey,
        },
      },
      update: {
        dismissedAt: new Date(),
      },
      create: {
        projectId,
        recommendationKey,
      },
    })

    return NextResponse.json({ success: true, dismissed: true })
  } catch (error) {
    console.error('Error dismissing recommendation:', error)
    return NextResponse.json(
      { error: 'Failed to dismiss recommendation' },
      { status: 500 }
    )
  }
}

// DELETE /api/projects/[id]/recommendations - Restore recommendation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id: projectId } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const recommendationKey = url.searchParams.get('key')

    if (!recommendationKey) {
      return NextResponse.json(
        { error: 'Missing recommendationKey' },
        { status: 400 }
      )
    }

    // Verify project ownership
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Delete the dismissed recommendation
    await prisma.dismissedRecommendation.delete({
      where: {
        projectId_recommendationKey: {
          projectId,
          recommendationKey,
        },
      },
    })

    return NextResponse.json({ success: true, dismissed: false })
  } catch (error) {
    // If not found, that's fine
    if ((error as any).code === 'P2025') {
      return NextResponse.json({ success: true, dismissed: false })
    }
    console.error('Error restoring recommendation:', error)
    return NextResponse.json(
      { error: 'Failed to restore recommendation' },
      { status: 500 }
    )
  }
}
