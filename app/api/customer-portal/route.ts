import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createPortalSession } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!dbUser?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Build return URL
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const returnUrl = `${origin}/dashboard`;

    // Create portal session
    const session = await createPortalSession({
      customerId: dbUser.stripeCustomerId,
      returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Customer portal error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
