'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, UserButton } from '@clerk/nextjs';
import type { ScanResult } from '@/lib/scanner';
import {
  Globe,
  Search,
  Zap,
  Shield,
  BarChart3,
  Share2,
  FileText,
  Bell,
  ArrowRight,
  Star,
  Check,
  Rocket,
  LayoutDashboard,
} from 'lucide-react';

const whatWeCheck = [
  {
    icon: Globe,
    title: "Domain",
    items: ["DNS setup", "SSL cert", "Redirects"],
  },
  {
    icon: Search,
    title: "SEO",
    items: ["Meta tags", "OG images", "Sitemap"],
  },
  {
    icon: Zap,
    title: "Performance",
    items: ["Page speed", "Core Web Vitals", "Image sizes"],
  },
  {
    icon: Shield,
    title: "Security",
    items: ["SSL cert", "Headers", "Best practices"],
  },
  {
    icon: BarChart3,
    title: "Analytics",
    items: ["Tracking setup", "Event flow", "Tools detected"],
  },
  {
    icon: Share2,
    title: "Social",
    items: ["Twitter/X", "LinkedIn", "Product Hunt"],
  },
  {
    icon: FileText,
    title: "Content",
    items: ["Copy quality", "CTAs", "Messaging"],
  },
  {
    icon: Bell,
    title: "Monitoring",
    items: ["Error tracking", "Uptime", "Alerts"],
  },
];

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    features: ["1 project", "1 scan/day"],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    features: ["6 projects", "Unlimited scans", "Auto-scans", "GitHub integration"],
    cta: "Try Pro →",
    popular: true,
  },
  {
    name: "Pro Plus",
    price: "$39",
    period: "/month",
    features: ["15 projects", "Unlimited scans", "Team (3)", "White-label"],
    cta: "Try Pro Plus",
    popular: false,
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "/month",
    features: ["Unlimited projects", "API access", "SLA support", "Custom checks"],
    cta: "Contact Sales",
    popular: false,
    href: "mailto:sales@launchready.me?subject=Enterprise%20Plan%20Inquiry",
  },
];

export default function Home() {
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<{ scans: number; projects: number } | null>(null);
  const router = useRouter();
  const { isSignedIn, user, isLoaded } = useUser();

  // Fetch real stats on mount
  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(() => setStats(null));
  }, []);

  const handleScan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Get URL from form data as fallback (helps with browser automation)
    const formData = new FormData(e.currentTarget);
    const urlValue = (formData.get('url') as string) || url;
    
    if (!urlValue?.trim()) {
      setError('URL is required');
      return;
    }
    
    setScanning(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: urlValue }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Scan failed');
      }

      const data = await response.json();
      // Store results and redirect to results page
      sessionStorage.setItem('scanResult', JSON.stringify(data));
      sessionStorage.setItem('scannedUrl', url);
      router.push('/results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan');
      setScanning(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-400';
    if (score >= 60) return 'bg-amber-400';
    return 'bg-red-400';
  };

  return (
    <main className="min-h-screen bg-[#0f172a] text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-700/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <a href={isSignedIn ? "/dashboard" : "/"} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Rocket className="w-6 h-6 text-indigo-500" />
            <span className="text-xl font-bold text-white">LaunchReady.me</span>
          </a>
          <nav className="flex items-center gap-4">
            {isLoaded && isSignedIn ? (
              <>
                <a href="/dashboard" className="text-slate-400 hover:text-white transition-colors px-4 py-2 flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </a>
                <UserButton 
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "w-9 h-9",
                    }
                  }}
                />
              </>
            ) : (
              <>
                <a href="/sign-in" className="text-slate-400 hover:text-white transition-colors px-4 py-2">
                  Login
                </a>
                <a href="/sign-up" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors">
                  Sign Up
                </a>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-600/10 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/20 rounded-full blur-[120px]" />
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white">
              <span className="inline-block mr-3">🚀</span>
              Is Your Project Ready to Launch?
            </h1>
            <p className="text-xl md:text-2xl text-slate-400 mb-4">
              Get a comprehensive readiness score across 8 critical areas
            </p>
            <p className="text-lg text-slate-400 mb-10">
              in 60 seconds. No signup required.
            </p>

            {/* URL Input */}
            <form onSubmit={handleScan} className="max-w-xl mx-auto mb-6" data-testid="scan-form">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    https://
                  </div>
                  <input
                    type="text"
                    name="url"
                    placeholder="yourproject.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full pl-20 pr-4 py-4 bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 text-lg rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    disabled={scanning}
                    data-testid="url-input"
                    aria-label="Project URL"
                  />
                </div>
                <button
                  type="submit"
                  disabled={scanning}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 text-lg rounded-xl whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  data-testid="scan-button"
                >
                  {scanning ? 'Scanning...' : 'Scan Your Project - Free'}
                  {!scanning && <ArrowRight className="w-5 h-5" />}
                </button>
              </div>
              {error && (
                <p className="text-red-400 mt-4" data-testid="error-message">{error}</p>
              )}
            </form>

            {/* Social proof */}
            {stats && stats.scans > 0 && (
              <p className="text-slate-500 flex items-center justify-center gap-2">
                <span className="text-amber-400">✨</span>
                {stats.scans.toLocaleString()} scans completed across {stats.projects.toLocaleString()} projects
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Scanning Progress */}
      {scanning && (
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
              <p className="text-slate-300 text-lg mb-2">Scanning {url}...</p>
              <p className="text-slate-500">Analyzing across 8 phases</p>
            </div>
          </div>
        </section>
      )}

      {/* Results */}
      {result && (
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Overall Score Card */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 mb-8">
              <div className="text-center">
                <p className="text-slate-400 mb-2">{url}</p>
                <div className={`text-7xl font-bold mb-2 ${getScoreColor(result.score)}`}>
                  {result.score}<span className="text-4xl text-slate-500">/100</span>
                </div>
                <div className="w-full max-w-md mx-auto bg-slate-700 rounded-full h-3 mb-4">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${getScoreBg(result.score)}`} 
                    style={{ width: `${result.score}%` }}
                  />
                </div>
                <p className="text-xl text-slate-300">
                  {result.score >= 80 ? 'Ready to Launch! ✨' : 
                   result.score >= 60 ? 'Almost there! Some improvements needed' : 
                   'Needs work before launch'}
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  Scanned: {new Date(result.scannedAt).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Phase Breakdown */}
            <h2 className="text-2xl font-bold mb-6 text-white">Phase Breakdown:</h2>
            <div className="grid gap-4 md:grid-cols-2 mb-8">
              {result.phases.map((phase, index) => {
                const phaseScore = Math.round((phase.score / phase.maxScore) * 100);
                const statusIcon = phaseScore >= 80 ? '✅' : phaseScore >= 60 ? '⚠️' : '❌';
                return (
                  <div key={index} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-lg text-white flex items-center gap-2">
                        {statusIcon} {phase.phaseName}
                      </h3>
                      <span className={`text-lg font-bold ${getScoreColor(phaseScore)}`}>
                        {phase.score}/{phase.maxScore}
                      </span>
                    </div>

                    {/* Findings */}
                    <div className="space-y-2 mb-3">
                      {phase.findings.slice(0, 3).map((finding, fIndex) => (
                        <div key={fIndex} className="text-sm flex items-start gap-2">
                          <span className={
                            finding.type === 'success' ? 'text-emerald-400' :
                            finding.type === 'warning' ? 'text-amber-400' :
                            'text-red-400'
                          }>
                            {finding.type === 'success' ? '✓' :
                             finding.type === 'warning' ? '⚠' : '✗'}
                          </span>
                          <span className="text-slate-300">{finding.message}</span>
                        </div>
                      ))}
                    </div>

                    {/* Recommendations (truncated for free tier) */}
                    {phase.recommendations.length > 0 && (
                      <div className="text-sm text-slate-400 border-t border-slate-700 pt-3">
                        <p className="font-semibold mb-1">💡 Top Recommendation:</p>
                        <p className="truncate text-slate-300">{phase.recommendations[0].title}</p>
                        <p className="text-indigo-400 mt-2 text-xs">
                          🔒 Create account to see {phase.recommendations.length} recommendations
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            <div className="bg-gradient-to-r from-indigo-900/50 to-indigo-800/50 border border-indigo-500/30 rounded-xl p-8 text-center">
              <h3 className="text-2xl font-bold mb-2 text-white">🚀 Create Free Account to:</h3>
              <ul className="text-slate-300 mb-6 space-y-2">
                <li>✅ Save these results and track over time</li>
                <li>✅ See all detailed recommendations</li>
                <li>✅ Get implementation guides</li>
                <li>✅ Scan once per day</li>
              </ul>
              <a 
                href="/sign-up"
                className="inline-block px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors"
              >
                Create Free Account →
              </a>
            </div>
          </div>
        </section>
      )}

      {/* What We Check Section - Only show if no result */}
      {!result && !scanning && (
        <>
          <section className="py-16 border-t border-slate-800">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-white">
                What We Check:
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
                {whatWeCheck.map((check, i) => (
                  <div
                    key={i}
                    className="bg-slate-800/50 border border-slate-700 hover:border-indigo-500/50 transition-all duration-300 rounded-xl p-5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <check.icon className="w-5 h-5 text-indigo-400" />
                      <h3 className="font-semibold text-white">{check.title}</h3>
                    </div>
                    <ul className="space-y-1">
                      {check.items.map((item, j) => (
                        <li key={j} className="text-sm text-slate-400 flex items-center gap-2">
                          <span className="text-slate-600">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Divider */}
          <div className="container mx-auto px-4">
            <div className="border-t border-slate-700/50" />
          </div>

          {/* How It Works Section */}
          <section className="py-16">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-white">
                How It Works:
              </h2>
              <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                <div className="text-center">
                  <div className="text-4xl mb-4">1️⃣</div>
                  <h3 className="text-xl font-semibold text-white mb-2">Paste your URL</h3>
                  <p className="text-slate-400">No code access needed</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-4">2️⃣</div>
                  <h3 className="text-xl font-semibold text-white mb-2">Wait 60 seconds</h3>
                  <p className="text-slate-400">Automated checks run</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-4">3️⃣</div>
                  <h3 className="text-xl font-semibold text-white mb-2">Get your score</h3>
                  <p className="text-slate-400">Actionable insights</p>
                </div>
              </div>
            </div>
          </section>

          {/* Divider */}
          <div className="container mx-auto px-4">
            <div className="border-t border-slate-700/50" />
          </div>

          {/* Pricing Section */}
          <section className="py-16">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-white">
                Pricing:
              </h2>
              <div className="grid md:grid-cols-4 gap-4 max-w-5xl mx-auto">
                {pricingPlans.map((plan, i) => (
                  <div
                    key={i}
                    className={`bg-slate-800/50 border border-slate-700 rounded-xl ${
                      plan.popular ? "ring-2 ring-indigo-500 relative" : ""
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-indigo-600 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                          <Star className="w-3 h-3" /> Popular
                        </span>
                      </div>
                    )}
                    <div className="p-6 pt-8">
                      <h3 className="text-lg font-semibold text-white mb-2">{plan.name}</h3>
                      <div className="mb-4">
                        <span className="text-3xl font-bold text-white">{plan.price}</span>
                        <span className="text-slate-400">{plan.period}</span>
                      </div>
                      <ul className="space-y-2 mb-6">
                        {plan.features.map((feature, j) => (
                          <li key={j} className="text-sm text-slate-400 flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      {'href' in plan ? (
                        <a
                          href={plan.href as string}
                          className={`w-full py-3 rounded-lg font-medium transition-colors block text-center ${
                            plan.popular
                              ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                              : "bg-slate-700 hover:bg-slate-600 text-white"
                          }`}
                        >
                          {plan.cta}
                        </a>
                      ) : (
                        <button
                          className={`w-full py-3 rounded-lg font-medium transition-colors ${
                            plan.popular
                              ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                              : "bg-slate-700 hover:bg-slate-600 text-white"
                          }`}
                        >
                          {plan.cta}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-700/50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-indigo-500" />
              <span className="font-semibold text-white">LaunchReady.me</span>
            </div>
            <nav className="flex items-center gap-6 text-sm text-slate-400">
              <a href="https://github.com/msanchezgrice/launchready#readme" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Docs</a>
              <a href="/pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="mailto:support@launchready.me" className="hover:text-white transition-colors">Support</a>
            </nav>
            <div className="flex items-center gap-4">
              <a href="https://x.com/launchreadyme" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="https://github.com/msanchezgrice/launchready" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </a>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-slate-800 text-center text-sm text-slate-500">
            © {new Date().getFullYear()} LaunchReady.me • Ship with confidence.
          </div>
        </div>
      </footer>
    </main>
  );
}
