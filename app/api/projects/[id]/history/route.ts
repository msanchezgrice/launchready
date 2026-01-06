/**
 * Project Scan History API
 * Returns historical scan data for trend visualization
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

type Params = Promise<{ id: string }>

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id: projectId } = await params
    const { userId } = await auth()

    // For authenticated users, verify project ownership
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
      })

      if (user) {
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            userId: user.id,
          },
        })

        if (!project) {
          return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }
      }
    }

    // Get all scans for this project, limited to last 30
    const scans = await prisma.scan.findMany({
      where: { projectId },
      orderBy: { scannedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        score: true,
        scannedAt: true,
        trigger: true,
      },
    })

    return NextResponse.json({
      scans,
      projectId,
    })
  } catch (error) {
    console.error('Error fetching scan history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    )
  }
}
