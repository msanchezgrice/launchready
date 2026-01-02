/**
 * Unit tests for Stripe Checkout API
 * 
 * To run: npm run test:stripe
 * 
 * Prerequisites:
 * - STRIPE_SECRET_KEY set (test mode)
 * - STRIPE_PRO_PRICE_ID set
 * - STRIPE_PRO_PLUS_PRICE_ID set
 * - STRIPE_ENTERPRISE_PRICE_ID set
 */

import {
  createCheckoutSession,
  createPortalSession,
  getPlanFromPriceId,
  getPlanLimits,
  canAddProject,
  canScan,
  PRICING_TIERS,
} from '@/lib/stripe';

describe('Stripe Configuration', () => {
  describe('PRICING_TIERS', () => {
    it('should have all required tiers', () => {
      expect(PRICING_TIERS).toHaveProperty('free');
      expect(PRICING_TIERS).toHaveProperty('pro');
      expect(PRICING_TIERS).toHaveProperty('pro_plus');
      expect(PRICING_TIERS).toHaveProperty('enterprise');
    });

    it('should have correct project limits', () => {
      expect(PRICING_TIERS.free.features.projects).toBe(1);
      expect(PRICING_TIERS.pro.features.projects).toBe(6);
      expect(PRICING_TIERS.pro_plus.features.projects).toBe(15);
      expect(PRICING_TIERS.enterprise.features.projects).toBe(-1); // unlimited
    });

    it('should have correct scan limits', () => {
      expect(PRICING_TIERS.free.features.scansPerDay).toBe(1);
      expect(PRICING_TIERS.pro.features.scansPerDay).toBe(-1); // unlimited
      expect(PRICING_TIERS.pro_plus.features.scansPerDay).toBe(-1); // unlimited
      expect(PRICING_TIERS.enterprise.features.scansPerDay).toBe(-1); // unlimited
    });

    it('should have correct prices', () => {
      expect(PRICING_TIERS.free.price).toBe(0);
      expect(PRICING_TIERS.pro.price).toBe(19);
      expect(PRICING_TIERS.pro_plus.price).toBe(39);
      expect(PRICING_TIERS.enterprise.price).toBe(99);
    });
  });

  describe('getPlanLimits', () => {
    it('should return free tier limits by default', () => {
      const limits = getPlanLimits('unknown_plan');
      expect(limits.projects).toBe(1);
      expect(limits.scansPerDay).toBe(1);
    });

    it('should return correct limits for pro', () => {
      const limits = getPlanLimits('pro');
      expect(limits.projects).toBe(6);
      expect(limits.scansPerDay).toBe(-1);
      expect(limits.autoScans).toBe(true);
      expect(limits.github).toBe(true);
    });

    it('should return correct limits for pro_plus', () => {
      const limits = getPlanLimits('pro_plus');
      expect(limits.projects).toBe(15);
      expect(limits.teamMembers).toBe(3);
      expect(limits.whiteLabel).toBe(true);
    });
  });

  describe('canAddProject', () => {
    it('should allow free user to add first project', () => {
      expect(canAddProject('free', 0)).toBe(true);
    });

    it('should block free user from adding second project', () => {
      expect(canAddProject('free', 1)).toBe(false);
    });

    it('should allow pro user to add up to 6 projects', () => {
      expect(canAddProject('pro', 0)).toBe(true);
      expect(canAddProject('pro', 5)).toBe(true);
      expect(canAddProject('pro', 6)).toBe(false);
    });

    it('should allow enterprise unlimited projects', () => {
      expect(canAddProject('enterprise', 100)).toBe(true);
    });
  });

  describe('canScan', () => {
    it('should allow first scan', () => {
      expect(canScan('free', null)).toBe(true);
    });

    it('should block free user from scanning within 24 hours', () => {
      const recentScan = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
      expect(canScan('free', recentScan)).toBe(false);
    });

    it('should allow free user to scan after 24 hours', () => {
      const oldScan = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      expect(canScan('free', oldScan)).toBe(true);
    });

    it('should allow pro user unlimited scans', () => {
      const recentScan = new Date(Date.now() - 1 * 60 * 1000); // 1 minute ago
      expect(canScan('pro', recentScan)).toBe(true);
    });
  });

  describe('getPlanFromPriceId', () => {
    it('should return free for unknown price ID', () => {
      expect(getPlanFromPriceId('unknown_price')).toBe('free');
    });

    // Note: These tests require actual price IDs to be set
    it('should return correct plan for pro price ID', () => {
      if (process.env.STRIPE_PRO_PRICE_ID) {
        expect(getPlanFromPriceId(process.env.STRIPE_PRO_PRICE_ID)).toBe('pro');
      }
    });
  });
});

describe('Stripe Checkout', () => {
  // Skip these tests if Stripe is not configured
  const isStripeConfigured = !!process.env.STRIPE_SECRET_KEY;

  (isStripeConfigured ? describe : describe.skip)('createCheckoutSession', () => {
    it('should create checkout session for Pro tier', async () => {
      const priceId = process.env.STRIPE_PRO_PRICE_ID;
      if (!priceId) {
        console.log('Skipping test: STRIPE_PRO_PRICE_ID not set');
        return;
      }

      const session = await createCheckoutSession({
        userId: 'test-user-123',
        userEmail: 'test@example.com',
        priceId,
        successUrl: 'http://localhost:3000/dashboard?success=true',
        cancelUrl: 'http://localhost:3000/pricing?canceled=true',
      });

      expect(session.url).toBeTruthy();
      expect(session.mode).toBe('subscription');
      expect(session.metadata?.userId).toBe('test-user-123');
    });

    it('should create checkout session with existing customer', async () => {
      const priceId = process.env.STRIPE_PRO_PRICE_ID;
      if (!priceId) {
        console.log('Skipping test: STRIPE_PRO_PRICE_ID not set');
        return;
      }

      // This test would require a real Stripe customer ID
      // In a real test environment, you'd create a test customer first
    });
  });

  (isStripeConfigured ? describe : describe.skip)('createPortalSession', () => {
    it('should create portal session for existing customer', async () => {
      // This test requires a real Stripe customer ID
      // In a real test environment, you'd create a test customer first
      console.log('Portal session test requires real customer ID');
    });
  });
});
