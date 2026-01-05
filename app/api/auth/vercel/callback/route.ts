/**
 * Vercel OAuth Callback
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
    console.error('[Vercel OAuth] Error:', error)
    return NextResponse.redirect(new URL('/dashboard?error=vercel_auth_failed', request.url))
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

  const clientId = process.env.VERCEL_CLIENT_ID
  const clientSecret = process.env.VERCEL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('[Vercel OAuth] Missing credentials')
    return NextResponse.redirect(new URL('/dashboard?error=config_error', request.url))
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/vercel/callback`,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error('[Vercel OAuth] Token error:', tokenData.error)
      return NextResponse.redirect(new URL('/dashboard?error=token_exchange_failed', request.url))
    }

    const accessToken = tokenData.access_token
    const teamId = tokenData.team_id

    // Get user's Vercel info
    const userResponse = await fetch('https://api.vercel.com/v2/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })
    const vercelUser = await userResponse.json()

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

    // Update project with Vercel token
    await prisma.project.update({
      where: { id: project.id },
      data: {
        vercelAccessToken: accessToken,
        vercelTeamId: teamId || null,
        vercelUsername: vercelUser.user?.username || vercelUser.user?.name,
      },
    })

    console.log(`[Vercel OAuth] Connected Vercel for project ${project.id}`)

    return NextResponse.redirect(
      new URL(`/projects/${project.id}?vercel=connected`, request.url)
    )
  } catch (error) {
    console.error('[Vercel OAuth] Error:', error)
    return NextResponse.redirect(new URL('/dashboard?error=vercel_auth_failed', request.url))
  }
}
