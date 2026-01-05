/**
 * User Repos API
 * Fetches the authenticated user's GitHub repositories
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user with GitHub token
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        githubAccessToken: true,
        githubUsername: true,
      },
    })

    if (!user?.githubAccessToken) {
      return NextResponse.json({
        repos: [],
        connected: false,
        message: 'GitHub not connected',
      })
    }

    // Fetch user's repos from GitHub
    const response = await fetch(
      'https://api.github.com/user/repos?per_page=100&sort=pushed&direction=desc',
      {
        headers: {
          Authorization: `Bearer ${user.githubAccessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      console.error('[User Repos] GitHub API error:', response.status)
      return NextResponse.json({
        repos: [],
        connected: true,
        error: 'Failed to fetch repos from GitHub',
      })
    }

    const repos = await response.json()

    // Return simplified repo list
    const simplifiedRepos = repos.map((repo: {
      full_name: string
      name: string
      description: string | null
      html_url: string
      private: boolean
      updated_at: string
      pushed_at: string
      language: string | null
    }) => ({
      fullName: repo.full_name, // owner/repo format
      name: repo.name,
      description: repo.description,
      url: repo.html_url,
      private: repo.private,
      updatedAt: repo.updated_at,
      pushedAt: repo.pushed_at,
      language: repo.language,
    }))

    return NextResponse.json({
      repos: simplifiedRepos,
      connected: true,
      username: user.githubUsername,
    })
  } catch (error) {
    console.error('[User Repos] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    )
  }
}
