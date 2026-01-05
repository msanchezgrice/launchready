/**
 * GitHub OAuth - Initiate OAuth flow
 * Redirects user to GitHub to authorize repo access (user-level)
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(request: Request) {
  const { userId } = await auth()
  
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  const { searchParams } = new URL(request.url)
  const returnTo = searchParams.get('returnTo') || '/settings'

  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) {
    console.error('[GitHub OAuth] Missing GITHUB_CLIENT_ID')
    return NextResponse.json({ error: 'GitHub OAuth not configured' }, { status: 500 })
  }

  // State includes userId and return path for callback
  const state = Buffer.from(JSON.stringify({ userId, returnTo })).toString('base64')
  
  // Request repo scope for code analysis
  const scope = 'repo'
  
  // Build the redirect URI - must match GitHub OAuth app settings exactly
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://launchready.me'
  const redirectUri = `${appUrl}/api/auth/github/callback`
  
  console.log('[GitHub OAuth] Initiating flow', { clientId, redirectUri, userId })
  
  const authUrl = new URL('https://github.com/login/oauth/authorize')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', scope)
  authUrl.searchParams.set('state', state)

  return NextResponse.redirect(authUrl.toString())
}
