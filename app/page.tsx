'use client';

import { useState } from 'react';
import type { ScanResult } from '@/lib/scanner';

export default function Home() {
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setScanning(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Scan failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan');
    } finally {
      setScanning(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-danger';
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl font-bold mb-4">
            🚀 <span className="text-primary">Launch</span>Ready
          </h1>
          <p className="text-2xl text-gray-300 mb-4">
            Get Your Product Launch-Ready
          </p>
          <p className="text-lg text-gray-400 mb-12">
            Comprehensive readiness scoring across 8 critical areas.<br />
            Know what to fix before you ship.
          </p>

          {/* Scan Form */}
          <form onSubmit={handleScan} className="mb-12">
            <div className="flex gap-4 max-w-2xl mx-auto">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="yourproject.com"
                className="flex-1 px-6 py-4 rounded-lg bg-card border border-border text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
                required
                disabled={scanning}
                pattern=".*\..+"
                title="Enter a domain like example.com or https://example.com"
              />
              <button
                type="submit"
                disabled={scanning}
                className="px-8 py-4 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scanning ? 'Scanning...' : 'Scan Now'}
              </button>
            </div>
            {error && (
              <p className="text-danger mt-4">{error}</p>
            )}
          </form>

          {/* Scanning Progress */}
          {scanning && (
            <div className="mb-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-gray-400">Analyzing your project across 8 phases...</p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="bg-card rounded-lg p-8 text-left">
              {/* Overall Score */}
              <div className="text-center mb-8 pb-8 border-b border-border">
                <div className={`text-7xl font-bold mb-2 ${getScoreColor(result.score)}`}>
                  {result.score}<span className="text-4xl text-gray-500">/100</span>
                </div>
                <p className="text-xl text-gray-400">Overall Readiness Score</p>
                <p className="text-sm text-gray-500 mt-2">
                  Scanned: {new Date(result.scannedAt).toLocaleString()}
                </p>
              </div>

              {/* Phase Breakdown */}
              <h2 className="text-2xl font-bold mb-6">Phase Breakdown</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {result.phases.map((phase, index) => {
                  const phaseScore = Math.round((phase.score / phase.maxScore) * 100);
                  return (
                    <div key={index} className="bg-background rounded-lg p-4 border border-border">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-semibold text-lg">{phase.phaseName}</h3>
                        <span className={`text-2xl font-bold ${getScoreColor(phaseScore)}`}>
                          {phaseScore}
                        </span>
                      </div>

                      {/* Findings */}
                      <div className="space-y-2 mb-3">
                        {phase.findings.slice(0, 2).map((finding, fIndex) => (
                          <div key={fIndex} className="text-sm">
                            <span className={
                              finding.type === 'success' ? 'text-success' :
                              finding.type === 'warning' ? 'text-warning' :
                              'text-danger'
                            }>
                              {finding.type === 'success' ? '✓' :
                               finding.type === 'warning' ? '⚠' : '✗'}
                            </span>
                            <span className="ml-2 text-gray-300">{finding.message}</span>
                          </div>
                        ))}
                      </div>

                      {/* Recommendations (truncated for free tier) */}
                      {phase.recommendations.length > 0 && (
                        <div className="text-sm text-gray-400 border-t border-border pt-3">
                          <p className="font-semibold mb-1">Top Recommendation:</p>
                          <p className="truncate">{phase.recommendations[0].title}</p>
                          <button className="text-primary hover:text-primary-hover mt-2 text-xs">
                            Create account to see {phase.recommendations.length} recommendations →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* CTA */}
              <div className="mt-8 p-6 bg-primary bg-opacity-10 border border-primary rounded-lg text-center">
                <h3 className="text-xl font-bold mb-2">Want the Full Report?</h3>
                <p className="text-gray-300 mb-4">
                  Create a free account to see all recommendations, track progress, and scan daily.
                </p>
                <button className="px-6 py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors">
                  Sign Up Free
                </button>
              </div>
            </div>
          )}

          {/* Features */}
          {!result && !scanning && (
            <div className="grid md:grid-cols-3 gap-8 mt-16 text-left">
              <div>
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="text-xl font-semibold mb-2">8-Phase Analysis</h3>
                <p className="text-gray-400">
                  Domain, SEO, Performance, Security, Analytics, Social, Content, and Monitoring
                </p>
              </div>
              <div>
                <div className="text-4xl mb-4">⚡</div>
                <h3 className="text-xl font-semibold mb-2">Instant Results</h3>
                <p className="text-gray-400">
                  Get your readiness score in seconds. No signup required for basic scan.
                </p>
              </div>
              <div>
                <div className="text-4xl mb-4">📈</div>
                <h3 className="text-xl font-semibold mb-2">Actionable Insights</h3>
                <p className="text-gray-400">
                  Clear recommendations with priority levels and implementation guides.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
