/**
 * GitHub OAuth Callback
 * Exchanges code for access token and stores it at user level
 * 
 * Stores the access mode (all/select) for future reference
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
    return NextResponse.redirect(new URL('/settings?error=github_auth_failed', request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/settings?error=missing_params', request.url))
  }

  // Decode state to get userId, returnTo, and mode
  let stateData: { userId: string; returnTo?: string; mode?: string }
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64').toString())
  } catch {
    return NextResponse.redirect(new URL('/settings?error=invalid_state', request.url))
  }

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('[GitHub OAuth] Missing credentials')
    return NextResponse.redirect(new URL('/settings?error=config_error', request.url))
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
      return NextResponse.redirect(new URL('/settings?error=token_exchange_failed', request.url))
    }

    const accessToken = tokenData.access_token
    const tokenScope = tokenData.scope // e.g., "repo,read:user" or "public_repo,read:user"

    // Get user's GitHub info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    })
    const githubUser = await userResponse.json()

    // Find the user by Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: stateData.userId },
    })

    if (!user) {
      return NextResponse.redirect(new URL('/settings?error=user_not_found', request.url))
    }

    // Determine access mode from state or infer from scope
    const accessMode = stateData.mode || (tokenScope?.includes('repo') ? 'all' : 'select')

    // Update user with GitHub token and access mode
    await prisma.user.update({
      where: { id: user.id },
      data: {
        githubAccessToken: accessToken,
        githubUsername: githubUser.login,
        githubConnectedAt: new Date(),
        githubAccessMode: accessMode, // 'all' or 'select'
      },
    })

    console.log(`[GitHub OAuth] Connected GitHub for user ${user.id} (${githubUser.login}) with ${accessMode} access`)

    const returnTo = stateData.returnTo || '/settings'
    return NextResponse.redirect(
      new URL(`${returnTo}?github=connected`, request.url)
    )
  } catch (error) {
    console.error('[GitHub OAuth] Error:', error)
    return NextResponse.redirect(new URL('/settings?error=github_auth_failed', request.url))
  }
}
