/**
 * GitHub Scan API
 * Triggers a GitHub repository scan for a project
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

  // Get project and verify ownership
  const project = await prisma.project.findFirst({
    where: {
      id,
      user: { clerkId: userId },
    },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  if (!project.githubAccessToken) {
    return NextResponse.json({ 
      error: 'GitHub not connected',
      message: 'Connect your GitHub repository first'
    }, { status: 400 })
  }

  if (!project.githubRepo) {
    return NextResponse.json({ 
      error: 'No GitHub repo configured',
      message: 'Add a GitHub repository URL to your project'
    }, { status: 400 })
  }

  try {
    const result = await scanGitHubRepo(project.githubAccessToken, project.githubRepo)
    return NextResponse.json({ result })
  } catch (error) {
    console.error('[GitHub Scan] Error:', error)
    return NextResponse.json({ 
      error: 'Scan failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
