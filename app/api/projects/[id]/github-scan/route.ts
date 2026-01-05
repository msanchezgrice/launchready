/**
 * GitHub Scan API
 * Triggers a GitHub repository scan for a project
 * Uses user-level GitHub token (not project-level)
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { scanGitHubRepo } from '@/lib/github-scanner'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Get project with user (to access user-level GitHub token)
  const project = await prisma.project.findFirst({
    where: {
      id,
      user: { clerkId: userId },
    },
    include: {
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

  // Check for user-level GitHub connection
  if (!project.user.githubAccessToken) {
    return NextResponse.json({ 
      error: 'GitHub not connected',
      message: 'Connect your GitHub account in Settings first'
    }, { status: 400 })
  }

  if (!project.githubRepo) {
    return NextResponse.json({ 
      error: 'No GitHub repo configured',
      message: 'Add a GitHub repository to your project settings'
    }, { status: 400 })
  }

  try {
    const result = await scanGitHubRepo(project.user.githubAccessToken, project.githubRepo)
    return NextResponse.json({ result })
  } catch (error) {
    console.error('[GitHub Scan] Error:', error)
    return NextResponse.json({ 
      error: 'Scan failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
