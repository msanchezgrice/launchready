import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createCheckoutSession, PRICING_TIERS, PlanType, getPriceId } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { plan } = body as { plan: PlanType };

    // Validate plan
    if (!plan || !PRICING_TIERS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const tier = PRICING_TIERS[plan];
    const priceId = getPriceId(plan);
    
    // Free tier doesn't need checkout
    if (plan === 'free' || !priceId) {
      console.error('Invalid plan or missing priceId:', { plan, priceId, envVars: {
        pro: process.env.STRIPE_PRO_PRICE_ID,
        pro_plus: process.env.STRIPE_PRO_PLUS_PRICE_ID,
        enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID,
      }});
      return NextResponse.json({ error: 'Cannot checkout for free tier or missing price configuration' }, { status: 400 });
    }

    // Get current user details
    const clerkUser = await currentUser();
    if (!clerkUser?.primaryEmailAddress?.emailAddress) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }

    // Get or create user in database
    let dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          clerkId: userId,
          email: clerkUser.primaryEmailAddress.emailAddress,
          name: clerkUser.firstName ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : null,
        },
      });
    }

    // Build URLs
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${origin}/dashboard?checkout=success&plan=${plan}`;
    const cancelUrl = `${origin}/pricing?checkout=canceled`;

    // Create checkout session
    const session = await createCheckoutSession({
      userId: dbUser.id,
      userEmail: clerkUser.primaryEmailAddress.emailAddress,
      priceId: priceId,
      successUrl,
      cancelUrl,
      customerId: dbUser.stripeCustomerId || undefined,
    });

    return NextResponse.json({ 
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
