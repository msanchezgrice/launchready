import Stripe from 'stripe';

// Make Stripe optional - only initialize if key is present
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      typescript: true,
    });
  }
  return stripeInstance;
}

// Export for backwards compatibility (throws if not configured)
export const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16', typescript: true })
  : (null as unknown as Stripe);

// Pricing tiers configuration (static data)
const PRICING_TIERS_BASE = {
  free: {
    name: 'Free',
    price: 0,
    features: {
      projects: 1,
      scansPerDay: 1,
      historyDays: 7,
      autoScans: false,
      github: false,
      pdfExport: false,
      teamMembers: 1,
      whiteLabel: false,
      apiAccess: false,
      prioritySupport: false,
    },
    description: 'Perfect for getting started',
  },
  pro: {
    name: 'Pro',
    price: 19,
    features: {
      projects: 6,
      scansPerDay: -1, // unlimited
      historyDays: 90,
      autoScans: true,
      github: true,
      pdfExport: true,
      teamMembers: 1,
      whiteLabel: false,
      apiAccess: false,
      prioritySupport: false,
    },
    description: 'For serious indie hackers',
  },
  pro_plus: {
    name: 'Pro Plus',
    price: 39,
    features: {
      projects: 15,
      scansPerDay: -1, // unlimited
      historyDays: 365,
      autoScans: true,
      github: true,
      pdfExport: true,
      teamMembers: 3,
      whiteLabel: true,
      apiAccess: false,
      prioritySupport: true,
    },
    description: 'For agencies and teams',
  },
  enterprise: {
    name: 'Enterprise',
    price: 99,
    features: {
      projects: -1, // unlimited
      scansPerDay: -1, // unlimited
      historyDays: -1, // unlimited
      autoScans: true,
      github: true,
      pdfExport: true,
      teamMembers: -1, // unlimited
      whiteLabel: true,
      apiAccess: true,
      prioritySupport: true,
    },
    description: 'For large organizations',
  },
} as const;

// Get priceId at runtime to ensure env vars are read correctly
export function getPriceId(plan: PlanType): string | null {
  switch (plan) {
    case 'free':
      return null;
    case 'pro':
      return process.env.STRIPE_PRO_PRICE_ID || null;
    case 'pro_plus':
      return process.env.STRIPE_PRO_PLUS_PRICE_ID || null;
    case 'enterprise':
      return process.env.STRIPE_ENTERPRISE_PRICE_ID || null;
    default:
      return null;
  }
}

// Export with priceId getter for compatibility
export const PRICING_TIERS = {
  free: { ...PRICING_TIERS_BASE.free, priceId: null as string | null },
  pro: { ...PRICING_TIERS_BASE.pro, get priceId() { return getPriceId('pro'); } },
  pro_plus: { ...PRICING_TIERS_BASE.pro_plus, get priceId() { return getPriceId('pro_plus'); } },
  enterprise: { ...PRICING_TIERS_BASE.enterprise, get priceId() { return getPriceId('enterprise'); } },
};

export type PlanType = keyof typeof PRICING_TIERS_BASE;

// Helper to get plan limits
export function getPlanLimits(plan: string) {
  const tierKey = plan as PlanType;
  return PRICING_TIERS[tierKey]?.features || PRICING_TIERS.free.features;
}

// Helper to check if user can add more projects
export function canAddProject(plan: string, currentProjectCount: number): boolean {
  const limits = getPlanLimits(plan);
  if (limits.projects === -1) return true;
  return currentProjectCount < limits.projects;
}

// Helper to check if user can scan
export function canScan(plan: string, lastScanTime: Date | null): boolean {
  const limits = getPlanLimits(plan);
  
  // Unlimited scans
  if (limits.scansPerDay === -1) return true;
  
  // Check if enough time has passed since last scan (24 hours for free tier)
  if (!lastScanTime) return true;
  
  const hoursSinceLastScan = (Date.now() - lastScanTime.getTime()) / (1000 * 60 * 60);
  return hoursSinceLastScan >= (24 / limits.scansPerDay);
}

// Create a Stripe checkout session
export async function createCheckoutSession({
  userId,
  userEmail,
  priceId,
  successUrl,
  cancelUrl,
  customerId,
}: {
  userId: string;
  userEmail: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
}) {
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
    },
    subscription_data: {
      metadata: {
        userId,
      },
    },
  };

  // If customer already exists, use their ID
  if (customerId) {
    sessionParams.customer = customerId;
  } else {
    // Create new customer with email
    sessionParams.customer_email = userEmail;
  }

  const session = await getStripe().checkout.sessions.create(sessionParams);
  return session;
}

// Create customer portal session
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session;
}

// Map Stripe price ID to plan name
export function getPlanFromPriceId(priceId: string): PlanType {
  for (const [planKey, planData] of Object.entries(PRICING_TIERS)) {
    if (planData.priceId === priceId) {
      return planKey as PlanType;
    }
  }
  return 'free';
}
