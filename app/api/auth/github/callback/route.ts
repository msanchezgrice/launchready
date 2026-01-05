/**
 * GitHub OAuth Callback
 * Exchanges code for access token and stores it
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    console.error('[GitHub OAuth] Error:', error)
    return NextResponse.redirect(new URL('/dashboard?error=github_auth_failed', request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard?error=missing_params', request.url))
  }

  // Decode state to get projectId and userId
  let stateData: { projectId: string; userId: string }
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64').toString())
  } catch {
    return NextResponse.redirect(new URL('/dashboard?error=invalid_state', request.url))
  }

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('[GitHub OAuth] Missing credentials')
    return NextResponse.redirect(new URL('/dashboard?error=config_error', request.url))
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error('[GitHub OAuth] Token error:', tokenData.error)
      return NextResponse.redirect(new URL('/dashboard?error=token_exchange_failed', request.url))
    }

    const accessToken = tokenData.access_token

    // Get user's GitHub info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    })
    const githubUser = await userResponse.json()

    // Find the project and verify ownership
    const project = await prisma.project.findFirst({
      where: {
        id: stateData.projectId,
        user: { clerkId: stateData.userId },
      },
    })

    if (!project) {
      return NextResponse.redirect(new URL('/dashboard?error=project_not_found', request.url))
    }

    // Update project with GitHub token
    await prisma.project.update({
      where: { id: project.id },
      data: {
        githubAccessToken: accessToken,
        githubUsername: githubUser.login,
      },
    })

    console.log(`[GitHub OAuth] Connected GitHub for project ${project.id}`)

    return NextResponse.redirect(
      new URL(`/projects/${project.id}?github=connected`, request.url)
    )
  } catch (error) {
    console.error('[GitHub OAuth] Error:', error)
    return NextResponse.redirect(new URL('/dashboard?error=github_auth_failed', request.url))
  }
}
