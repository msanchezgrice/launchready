/**
 * Vercel OAuth Callback
 * Exchanges code for access token and stores it at user level
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
    return NextResponse.redirect(new URL('/settings?error=vercel_auth_failed', request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/settings?error=missing_params', request.url))
  }

  // Decode state to get userId and returnTo
  let stateData: { userId: string; returnTo?: string }
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64').toString())
  } catch {
    return NextResponse.redirect(new URL('/settings?error=invalid_state', request.url))
  }

  const clientId = process.env.VERCEL_CLIENT_ID
  const clientSecret = process.env.VERCEL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('[Vercel OAuth] Missing credentials')
    return NextResponse.redirect(new URL('/settings?error=config_error', request.url))
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://launchready.me'
  const redirectUri = `${appUrl}/api/auth/vercel/callback`

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
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error('[Vercel OAuth] Token error:', tokenData.error)
      return NextResponse.redirect(new URL('/settings?error=token_exchange_failed', request.url))
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

    // Find the user by Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: stateData.userId },
    })

    if (!user) {
      return NextResponse.redirect(new URL('/settings?error=user_not_found', request.url))
    }

    // Update user with Vercel token (user-level, not project-level)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        vercelAccessToken: accessToken,
        vercelTeamId: teamId || null,
        vercelUsername: vercelUser.user?.username || vercelUser.user?.name,
        vercelConnectedAt: new Date(),
      },
    })

    console.log(`[Vercel OAuth] Connected Vercel for user ${user.id}`)

    const returnTo = stateData.returnTo || '/settings'
    return NextResponse.redirect(
      new URL(`${returnTo}?vercel=connected`, request.url)
    )
  } catch (error) {
    console.error('[Vercel OAuth] Error:', error)
    return NextResponse.redirect(new URL('/settings?error=vercel_auth_failed', request.url))
  }
}
