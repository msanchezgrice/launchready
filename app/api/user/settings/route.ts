/**
 * User Settings API
 * GET: Fetch user settings including integration status
 * PATCH: Update user settings
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

// GET /api/user/settings - Get user settings
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        // Notification preferences
        scoreDropAlerts: true,
        weeklyDigest: true,
        scanCompleteNotify: true,
        // GitHub integration
        githubUsername: true,
        githubConnectedAt: true,
        // Vercel integration  
        vercelUsername: true,
        vercelTeamId: true,
        vercelConnectedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Return user settings with computed fields
    return NextResponse.json({
      user: {
        ...user,
        githubConnected: !!user.githubConnectedAt,
        vercelConnected: !!user.vercelConnectedAt,
      },
    })
  } catch (error) {
    console.error('Error fetching user settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/user/settings - Update user settings
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { scoreDropAlerts, weeklyDigest, scanCompleteNotify } = body

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(typeof scoreDropAlerts === 'boolean' && { scoreDropAlerts }),
        ...(typeof weeklyDigest === 'boolean' && { weeklyDigest }),
        ...(typeof scanCompleteNotify === 'boolean' && { scanCompleteNotify }),
      },
      select: {
        scoreDropAlerts: true,
        weeklyDigest: true,
        scanCompleteNotify: true,
      },
    })

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('Error updating user settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
