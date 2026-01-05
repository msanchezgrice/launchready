'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';
import {
  Rocket,
  Check,
  X,
  ArrowRight,
  Loader2,
  Crown,
  Building,
  Star,
  Zap,
} from 'lucide-react';

const pricingTiers = [
  {
    key: 'free',
    name: 'Free',
    price: 0,
    description: 'Perfect for getting started',
    icon: Rocket,
    highlight: false,
    features: [
      { name: '1 project', included: true },
      { name: '1 scan per day', included: true },
      { name: '7 days of history', included: true },
      { name: 'Basic recommendations', included: true },
      { name: 'Auto-scans', included: false },
      { name: 'GitHub integration', included: false },
      { name: 'PDF export', included: false },
      { name: 'Team members', included: false },
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 19,
    description: 'For serious indie hackers',
    icon: Star,
    highlight: true,
    badge: 'Most Popular',
    features: [
      { name: '6 projects', included: true },
      { name: 'Unlimited scans', included: true },
      { name: '90 days of history', included: true },
      { name: 'Full recommendations', included: true },
      { name: 'Auto-scans (daily/weekly)', included: true },
      { name: 'GitHub integration', included: true },
      { name: 'PDF export', included: true },
      { name: 'Team members', included: false },
    ],
  },
  {
    key: 'pro_plus',
    name: 'Pro Plus',
    price: 39,
    description: 'For agencies and teams',
    icon: Crown,
    highlight: false,
    features: [
      { name: '15 projects', included: true },
      { name: 'Unlimited scans', included: true },
      { name: '1 year of history', included: true },
      { name: 'Full recommendations', included: true },
      { name: 'Auto-scans (daily/weekly)', included: true },
      { name: 'GitHub integration', included: true },
      { name: 'PDF export', included: true },
      { name: '3 team members', included: true },
      { name: 'White-label reports', included: true },
      { name: 'Priority support', included: true },
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 99,
    description: 'For large organizations',
    icon: Building,
    highlight: false,
    features: [
      { name: 'Unlimited projects', included: true },
      { name: 'Unlimited scans', included: true },
      { name: 'Unlimited history', included: true },
      { name: 'Full recommendations', included: true },
      { name: 'Auto-scans (any schedule)', included: true },
      { name: 'GitHub integration', included: true },
      { name: 'PDF export', included: true },
      { name: 'Unlimited team members', included: true },
      { name: 'White-label reports', included: true },
      { name: 'API access', included: true },
      { name: 'SLA support', included: true },
      { name: 'Custom checks', included: true },
    ],
  },
];

export default function PricingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useUser();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const checkoutCanceled = searchParams.get('checkout') === 'canceled';

  const handleSelectPlan = async (planKey: string) => {
    if (planKey === 'free') {
      router.push('/dashboard');
      return;
    }

    if (!isSignedIn) {
      // Redirect to sign in, then come back to pricing
      router.push(`/sign-up?redirect_url=/pricing?plan=${planKey}`);
      return;
    }

    setLoadingPlan(planKey);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      });

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        console.error('Checkout error:', data.error);
        alert('Failed to start checkout. Please try again.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <Rocket className="h-8 w-8 text-indigo-500" />
              <span className="text-xl font-bold text-white">LaunchReady.me</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-slate-300 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              {!isLoaded ? null : isSignedIn ? (
                <Link
                  href="/dashboard"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <SignInButton mode="modal">
                  <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
                    Sign In
                  </button>
                </SignInButton>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Checkout Canceled Banner */}
        {checkoutCanceled && (
          <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-center">
            Checkout was canceled. Feel free to try again or reach out if you have questions.
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Choose the plan that fits your needs. All plans include our core scanning features.
            Upgrade or downgrade anytime.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {pricingTiers.map((tier) => {
            const Icon = tier.icon;
            return (
              <div
                key={tier.key}
                className={`relative rounded-2xl p-8 ${
                  tier.highlight
                    ? 'bg-indigo-600/20 border-2 border-indigo-500 shadow-lg shadow-indigo-500/20'
                    : 'bg-slate-800/50 border border-slate-700'
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-indigo-600 text-white text-sm font-medium rounded-full flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {tier.badge}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`p-2 rounded-lg ${
                      tier.highlight ? 'bg-indigo-500/30' : 'bg-slate-700/50'
                    }`}
                  >
                    <Icon
                      className={`h-6 w-6 ${
                        tier.highlight ? 'text-indigo-400' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                </div>

                <div className="mb-4">
                  <span className="text-4xl font-bold text-white">${tier.price}</span>
                  {tier.price > 0 && (
                    <span className="text-slate-400 ml-1">/month</span>
                  )}
                </div>

                <p className="text-slate-400 mb-6">{tier.description}</p>

                {tier.key === 'enterprise' ? (
                  <a
                    href="mailto:sales@launchready.me?subject=Enterprise%20Plan%20Inquiry"
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white`}
                  >
                    Contact Sales
                    <ArrowRight className="h-4 w-4" />
                  </a>
                ) : (
                  <button
                    onClick={() => handleSelectPlan(tier.key)}
                    disabled={loadingPlan !== null}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                      tier.highlight
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {loadingPlan === tier.key ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : tier.key === 'free' ? (
                      <>
                        Start Free
                        <ArrowRight className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Upgrade to {tier.name}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                )}

                <ul className="mt-8 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature.name} className="flex items-start gap-3">
                      {feature.included ? (
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
                      )}
                      <span
                        className={
                          feature.included ? 'text-slate-300' : 'text-slate-500'
                        }
                      >
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <section className="mt-24">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-slate-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Can I cancel anytime?
              </h3>
              <p className="text-slate-400">
                Yes! You can cancel your subscription at any time. You&apos;ll continue to have access until the end of your billing period.
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-slate-400">
                We accept all major credit cards through Stripe. Your payment information is secure and never stored on our servers.
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Can I change plans later?
              </h3>
              <p className="text-slate-400">
                Absolutely! You can upgrade or downgrade your plan at any time. Changes take effect immediately, with prorated billing.
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Do you offer refunds?
              </h3>
              <p className="text-slate-400">
                We offer a 14-day money-back guarantee. If you&apos;re not satisfied, contact us for a full refund.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="mt-24 text-center">
          <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-2xl p-12 border border-indigo-500/30">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Launch with Confidence?
            </h2>
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Start with a free scan and see how LaunchReady can help you ship better products.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
            >
              <Rocket className="h-5 w-5" />
              Scan Your Project Free
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Rocket className="h-6 w-6 text-indigo-500" />
              <span className="font-bold text-white">LaunchReady.me</span>
            </div>
            <div className="flex items-center gap-6 text-slate-400">
              <Link href="/pricing" className="hover:text-white transition-colors">
                Pricing
              </Link>
              <a href="https://github.com/msanchezgrice/launchready#readme" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                Docs
              </a>
              <a href="mailto:support@launchready.me" className="hover:text-white transition-colors">
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
