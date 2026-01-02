'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, UserButton } from '@clerk/nextjs';
import type { ScanResult } from '@/lib/scanner';
import {
  ArrowLeft,
  Rocket,
  LayoutDashboard,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';

export default function ResultsPage() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scannedUrl, setScannedUrl] = useState<string>('');
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    // Load scan result from sessionStorage
    const storedResult = sessionStorage.getItem('scanResult');
    const storedUrl = sessionStorage.getItem('scannedUrl');
    
    if (storedResult && storedUrl) {
      setResult(JSON.parse(storedResult));
      setScannedUrl(storedUrl);
    } else {
      // No result found, redirect to home
      router.push('/');
    }
  }, [router]);

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

  const getScoreStatus = (score: number) => {
    if (score >= 80) return { text: 'Ready to Launch! ✨', color: 'text-emerald-400' };
    if (score >= 60) return { text: 'Almost there! Some improvements needed', color: 'text-amber-400' };
    return { text: 'Needs work before launch', color: 'text-red-400' };
  };

  const togglePhase = (index: number) => {
    const newExpanded = new Set(expandedPhases);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedPhases(newExpanded);
  };

  const getPhaseIcon = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return '✅';
    if (percentage >= 60) return '⚠️';
    return '❌';
  };

  if (!result) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const status = getScoreStatus(result.score);
  const passedPhases = result.phases.filter(p => (p.score / p.maxScore) >= 0.8).length;
  const warningPhases = result.phases.filter(p => {
    const pct = p.score / p.maxScore;
    return pct >= 0.6 && pct < 0.8;
  }).length;
  const failedPhases = result.phases.filter(p => (p.score / p.maxScore) < 0.6).length;

  return (
    <main className="min-h-screen bg-[#0f172a] text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-700/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <a href={isSignedIn ? "/dashboard" : "/"} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Rocket className="w-6 h-6 text-indigo-500" />
              <span className="text-xl font-bold text-white">LaunchReady.me</span>
            </a>
          </div>
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

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* URL and timestamp */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <a 
              href={`https://${scannedUrl}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-2xl font-bold text-white hover:text-indigo-400 transition-colors flex items-center gap-2"
            >
              {scannedUrl}
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
          <p className="text-slate-500">
            Scanned: {new Date(result.scannedAt).toLocaleString()}
          </p>
        </div>

        {/* Overall Score Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 mb-8">
          <div className="text-center">
            <div className={`text-7xl font-bold mb-2 ${getScoreColor(result.score)}`}>
              {result.score}<span className="text-4xl text-slate-500">/100</span>
            </div>
            <div className="w-full max-w-md mx-auto bg-slate-700 rounded-full h-3 mb-4">
              <div 
                className={`h-3 rounded-full transition-all duration-500 ${getScoreBg(result.score)}`} 
                style={{ width: `${result.score}%` }}
              />
            </div>
            <p className={`text-xl ${status.color}`}>
              {status.text}
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{passedPhases}</div>
            <div className="text-slate-400 text-sm">Phases Passed ✅</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{warningPhases}</div>
            <div className="text-slate-400 text-sm">Warnings ⚠️</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{failedPhases}</div>
            <div className="text-slate-400 text-sm">Need Work ❌</div>
          </div>
        </div>

        {/* Phase Breakdown */}
        <h2 className="text-2xl font-bold mb-6 text-white">Phase Breakdown:</h2>
        <div className="space-y-4 mb-8">
          {result.phases.map((phase, index) => {
            const phaseScore = Math.round((phase.score / phase.maxScore) * 100);
            const isExpanded = expandedPhases.has(index);
            const icon = getPhaseIcon(phase.score, phase.maxScore);
            
            return (
              <div 
                key={index} 
                className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden"
              >
                {/* Phase Header - Clickable */}
                <button
                  onClick={() => togglePhase(index)}
                  className="w-full p-5 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{icon}</span>
                    <h3 className="font-semibold text-lg text-white">
                      {index + 1}. {phase.phaseName}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-lg font-bold ${getScoreColor(phaseScore)}`}>
                      {phase.score}/{phase.maxScore}
                    </span>
                    <span className="text-slate-400 text-sm w-20 text-right">
                      {phaseScore}%
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-slate-700">
                    {/* Findings */}
                    {phase.findings.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-slate-400 mb-2">Findings:</h4>
                        <div className="space-y-2">
                          {phase.findings.map((finding, fIndex) => (
                            <div key={fIndex} className="flex items-start gap-2">
                              <span className={
                                finding.type === 'success' ? 'text-emerald-400' :
                                finding.type === 'warning' ? 'text-amber-400' :
                                'text-red-400'
                              }>
                                {finding.type === 'success' ? '✓' :
                                 finding.type === 'warning' ? '⚠' : '✗'}
                              </span>
                              <div>
                                <span className="text-slate-300">{finding.message}</span>
                                {finding.details && (
                                  <p className="text-slate-500 text-sm">{finding.details}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {phase.recommendations.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-slate-400 mb-2">
                          💡 Recommendations ({phase.recommendations.length}):
                        </h4>
                        <div className="space-y-3">
                          {phase.recommendations.slice(0, isSignedIn ? undefined : 2).map((rec, rIndex) => (
                            <div key={rIndex} className="bg-slate-900/50 rounded-lg p-3">
                              <div className="flex items-start gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  rec.priority === 'high' ? 'bg-red-900/50 text-red-400' :
                                  rec.priority === 'medium' ? 'bg-amber-900/50 text-amber-400' :
                                  'bg-slate-700 text-slate-400'
                                }`}>
                                  {rec.priority}
                                </span>
                                <div>
                                  <p className="text-white font-medium">{rec.title}</p>
                                  <p className="text-slate-400 text-sm">{rec.description}</p>
                                  {rec.actionable && (
                                    <p className="text-indigo-400 text-sm mt-1">
                                      → {rec.actionable}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          {!isSignedIn && phase.recommendations.length > 2 && (
                            <p className="text-indigo-400 text-sm">
                              🔒 Create account to see {phase.recommendations.length - 2} more recommendations
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA for non-signed-in users */}
        {!isSignedIn && (
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
        )}

        {/* CTA for signed-in users */}
        {isSignedIn && (
          <div className="bg-gradient-to-r from-emerald-900/50 to-emerald-800/50 border border-emerald-500/30 rounded-xl p-8 text-center">
            <h3 className="text-2xl font-bold mb-2 text-white">📊 Want to track this project?</h3>
            <p className="text-slate-300 mb-6">
              Add it to your dashboard to monitor improvements over time
            </p>
            <a 
              href="/dashboard"
              className="inline-block px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
            >
              Go to Dashboard →
            </a>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} LaunchReady.me • Ship with confidence.
        </div>
      </footer>
    </main>
  );
}
