/**
 * Disconnect Integration API
 * POST - Disconnect GitHub or Vercel integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { provider } = body

    if (!provider || !['github', 'vercel'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (provider === 'github') {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          githubAccessToken: null,
          githubUsername: null,
          githubConnectedAt: null,
        },
      })
      console.log(`[Disconnect] GitHub disconnected for user ${dbUser.id}`)
    } else if (provider === 'vercel') {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          vercelAccessToken: null,
          vercelTeamId: null,
          vercelUsername: null,
          vercelConnectedAt: null,
        },
      })
      console.log(`[Disconnect] Vercel disconnected for user ${dbUser.id}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disconnecting integration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
