/**
 * GitHub OAuth - Initiate OAuth flow
 * Redirects user to GitHub to authorize repo access
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(request: Request) {
  const { userId } = await auth()
  
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  }

  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) {
    console.error('[GitHub OAuth] Missing GITHUB_CLIENT_ID')
    return NextResponse.json({ error: 'GitHub OAuth not configured' }, { status: 500 })
  }

  // State includes projectId for callback
  const state = Buffer.from(JSON.stringify({ projectId, userId })).toString('base64')
  
  // Request repo:read scope for code analysis
  const scope = 'repo'
  
  const authUrl = new URL('https://github.com/login/oauth/authorize')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`)
  authUrl.searchParams.set('scope', scope)
  authUrl.searchParams.set('state', state)

  return NextResponse.redirect(authUrl.toString())
}
