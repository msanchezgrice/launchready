/**
 * Disconnect GitHub from user account
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        githubAccessToken: null,
        githubUsername: null,
        githubConnectedAt: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disconnecting GitHub:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
