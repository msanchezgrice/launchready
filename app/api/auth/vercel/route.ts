/**
 * Vercel OAuth - Initiate OAuth flow
 * Redirects user to Vercel to authorize project access
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

  const clientId = process.env.VERCEL_CLIENT_ID
  if (!clientId) {
    console.error('[Vercel OAuth] Missing VERCEL_CLIENT_ID')
    return NextResponse.json({ error: 'Vercel OAuth not configured' }, { status: 500 })
  }

  // State includes projectId for callback
  const state = Buffer.from(JSON.stringify({ projectId, userId })).toString('base64')
  
  const authUrl = new URL('https://vercel.com/integrations/launchready/new')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/vercel/callback`)
  authUrl.searchParams.set('state', state)

  return NextResponse.redirect(authUrl.toString())
}
