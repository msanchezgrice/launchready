import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe, getPlanFromPriceId } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

// Disable body parsing for webhook
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    console.error('Missing stripe-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('Missing STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Webhook signature verification failed: ${errorMessage}`);
    return NextResponse.json({ error: `Webhook Error: ${errorMessage}` }, { status: 400 });
  }

  console.log(`Processing webhook event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId) {
    console.error('No userId in session metadata');
    return;
  }

  console.log(`Checkout completed for user: ${userId}, customer: ${customerId}`);

  // Update user with Stripe customer ID
  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    },
  });
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;
  const status = subscription.status;

  console.log(`Subscription ${subscription.id} changed: status=${status}, priceId=${priceId}`);

  // Find user by Stripe customer ID
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    // Try to find by userId in subscription metadata
    const userId = subscription.metadata?.userId;
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          subscriptionStatus: status,
          plan: status === 'active' ? getPlanFromPriceId(priceId) : 'free',
          subscriptionEndDate: subscription.cancel_at 
            ? new Date(subscription.cancel_at * 1000) 
            : null,
        },
      });
    } else {
      console.error(`No user found for customer: ${customerId}`);
    }
    return;
  }

  // Determine plan based on price ID
  const plan = status === 'active' ? getPlanFromPriceId(priceId) : 'free';

  await prisma.user.update({
    where: { stripeCustomerId: customerId },
    data: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionStatus: status,
      plan,
      subscriptionEndDate: subscription.cancel_at 
        ? new Date(subscription.cancel_at * 1000) 
        : null,
    },
  });

  console.log(`Updated user ${user.id} to plan: ${plan}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  console.log(`Subscription deleted for customer: ${customerId}`);

  // Downgrade user to free plan
  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      plan: 'free',
      stripeSubscriptionId: null,
      stripePriceId: null,
      subscriptionStatus: 'canceled',
      subscriptionEndDate: new Date(),
    },
  });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  console.log(`Payment succeeded for customer: ${customerId}`);

  // Ensure subscription is active
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription as string
    );
    await handleSubscriptionChange(subscription);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  console.log(`Payment failed for customer: ${customerId}`);

  // Update subscription status
  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      subscriptionStatus: 'past_due',
    },
  });
}
