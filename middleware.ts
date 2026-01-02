import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/projects(.*)',
  '/settings(.*)',
  '/api/projects(.*)',
  '/api/checkout(.*)',
  '/api/customer-portal(.*)',
]);

// Define public routes that should bypass Clerk
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/scan',
  '/api/webhooks(.*)',
  '/pricing',
  '/results(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect routes that require authentication
  if (isProtectedRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      // For API routes, return JSON 401 instead of redirecting
      if (req.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Please sign in to access this resource' },
          { status: 401 }
        );
      }
      // For page routes, redirect to sign-in
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
