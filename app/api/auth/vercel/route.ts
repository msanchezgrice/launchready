/**
 * Vercel OAuth - Initiate OAuth flow
 * Redirects user to Vercel to authorize project access (user-level)
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

  const clientId = process.env.VERCEL_CLIENT_ID
  if (!clientId) {
    console.error('[Vercel OAuth] Missing VERCEL_CLIENT_ID')
    return NextResponse.json({ error: 'Vercel OAuth not configured' }, { status: 500 })
  }

  // State includes userId and return path for callback
  const state = Buffer.from(JSON.stringify({ userId, returnTo })).toString('base64')
  
  // Build the redirect URI
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://launchready.me'
  const redirectUri = `${appUrl}/api/auth/vercel/callback`
  
  console.log('[Vercel OAuth] Initiating flow', { clientId, redirectUri, userId })
  
  // Note: Vercel OAuth uses their integrations flow
  // If you have a verified integration, use: https://vercel.com/integrations/YOUR_INTEGRATION/new
  // Otherwise, use the standard OAuth flow
  const authUrl = new URL('https://vercel.com/oauth/authorize')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('scope', 'user')

  return NextResponse.redirect(authUrl.toString())
}
