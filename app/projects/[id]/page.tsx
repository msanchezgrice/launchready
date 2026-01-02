'use client'

import { useEffect, useState, use } from 'react'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import {
  Rocket,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Check,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface Finding {
  type: 'success' | 'warning' | 'error'
  message: string
  details?: string
}

interface Recommendation {
  title: string
  description?: string
  priority?: 'high' | 'medium' | 'low'
  actionable?: string
}

interface Phase {
  id: string
  phaseName: string
  score: number
  maxScore: number
  findings: Finding[] | string
  recommendations: Recommendation[] | string | null
}

interface Scan {
  id: string
  score: number
  scannedAt: string
  phases: Phase[]
}

interface Project {
  id: string
  name: string
  url: string
  createdAt: string
  scans: Scan[]
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchProject()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id])

  async function fetchProject() {
    try {
      const res = await fetch(`/api/projects/${resolvedParams.id}`)
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/sign-in'
          return
        }
        throw new Error('Failed to load project')
      }
      const data = await res.json()
      setProject(data.project)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  async function handleRescan() {
    setScanning(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${resolvedParams.id}/scan`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || data.message || 'Scan failed')
      }
      await fetchProject()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  function togglePhase(index: number) {
    const newExpanded = new Set(expandedPhases)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedPhases(newExpanded)
  }

  function parseJSON(data: unknown, fallback: unknown[] = []): unknown[] {
    // Handle already-parsed objects (from Prisma JSON fields)
    if (Array.isArray(data)) {
      return data
    }
    // Handle string JSON
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data)
        return Array.isArray(parsed) ? parsed : fallback
      } catch {
        return fallback
      }
    }
    // Handle object (might be a single finding/recommendation)
    if (data && typeof data === 'object') {
      return [data]
    }
    return fallback
  }

  function getScoreColor(score: number, max: number) {
    const pct = (score / max) * 100
    if (pct >= 80) return 'text-emerald-400'
    if (pct >= 60) return 'text-amber-400'
    return 'text-red-400'
  }

  function getScoreBg(score: number, max: number) {
    const pct = (score / max) * 100
    if (pct >= 80) return 'bg-emerald-500'
    if (pct >= 60) return 'bg-amber-500'
    return 'bg-red-500'
  }

  function getPhaseIcon(score: number, max: number) {
    const pct = (score / max) * 100
    if (pct >= 80) return <Check className="w-5 h-5 text-emerald-400" />
    if (pct >= 60) return <AlertTriangle className="w-5 h-5 text-amber-400" />
    return <X className="w-5 h-5 text-red-400" />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Loading project...
        </div>
      </div>
    )
  }

  if (error && !project) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Project not found</p>
          <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const latestScan = project.scans[0]

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
              <span className="text-slate-600">|</span>
              <Link href="/" className="flex items-center gap-2">
                <Rocket className="h-6 w-6 text-indigo-500" />
                <span className="text-lg font-bold">LaunchReady.me</span>
              </Link>
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-600/30 rounded-lg">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Project Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-1"
          >
            {project.url}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {latestScan ? (
          <>
            {/* Overall Score Card */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 mb-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="text-center md:text-left">
                  <p className="text-slate-400 mb-1">Overall Score</p>
                  <div className={`text-6xl font-bold ${getScoreColor(latestScan.score, 100)}`}>
                    {latestScan.score}
                    <span className="text-3xl text-slate-500">/100</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">
                    Scanned: {new Date(latestScan.scannedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="w-full md:w-64 bg-slate-700 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all duration-500 ${getScoreBg(latestScan.score, 100)}`}
                      style={{ width: `${latestScan.score}%` }}
                    />
                  </div>
                  <p className="text-center md:text-right text-slate-300">
                    {latestScan.score >= 80
                      ? '✨ Ready to Launch!'
                      : latestScan.score >= 60
                      ? '⚠️ Almost there - some improvements needed'
                      : '❌ Needs work before launch'}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 mb-8">
              <button
                onClick={handleRescan}
                disabled={scanning}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {scanning ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Rescan Now
                  </>
                )}
              </button>
            </div>

            {/* Phase Breakdown */}
            <h2 className="text-2xl font-bold mb-6">Phase Breakdown</h2>
            <div className="space-y-4 mb-8">
              {latestScan.phases.map((phase, index) => {
                const findings = parseJSON(phase.findings, [])
                const recommendations = parseJSON(phase.recommendations, [])
                const isExpanded = expandedPhases.has(index)
                const phasePct = Math.round((phase.score / phase.maxScore) * 100)

                return (
                  <div
                    key={phase.id}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden"
                  >
                    {/* Phase Header */}
                    <button
                      onClick={() => togglePhase(index)}
                      className="w-full p-5 flex items-center justify-between hover:bg-slate-800/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {getPhaseIcon(phase.score, phase.maxScore)}
                        <span className="font-semibold text-lg">{phase.phaseName}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-lg font-bold ${getScoreColor(phase.score, phase.maxScore)}`}>
                          {phase.score}/{phase.maxScore}
                        </span>
                        <span className={`text-sm ${getScoreColor(phase.score, phase.maxScore)}`}>
                          ({phasePct}%)
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
                      <div className="px-5 pb-5 border-t border-slate-700 pt-4">
                        {/* Findings */}
                        {findings.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold text-slate-400 mb-3">Findings:</h4>
                            <div className="space-y-2">
                              {(findings as Finding[]).map((finding, fIndex) => (
                                <div key={fIndex} className="flex items-start gap-2 text-sm">
                                  <span
                                    className={
                                      finding.type === 'success'
                                        ? 'text-emerald-400'
                                        : finding.type === 'warning'
                                        ? 'text-amber-400'
                                        : 'text-red-400'
                                    }
                                  >
                                    {finding.type === 'success' ? '✓' : finding.type === 'warning' ? '⚠' : '✗'}
                                  </span>
                                  <div>
                                    <span className="text-slate-300">{finding.message}</span>
                                    {finding.details && (
                                      <p className="text-xs text-slate-500 mt-1">{finding.details}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recommendations */}
                        {recommendations.length > 0 && (
                          <div className="border-t border-slate-700 pt-4">
                            <h4 className="text-sm font-semibold text-slate-400 mb-3">💡 Recommendations:</h4>
                            <div className="space-y-3">
                              {(recommendations as Recommendation[]).map((rec, rIndex) => (
                                  <div
                                    key={rIndex}
                                    className="bg-slate-700/30 rounded-lg p-4"
                                  >
                                    <div className="flex items-start gap-2">
                                      {rec.priority === 'high' && (
                                        <span className="inline-block px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">High</span>
                                      )}
                                      {rec.priority === 'medium' && (
                                        <span className="inline-block px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">Medium</span>
                                      )}
                                      {rec.priority === 'low' && (
                                        <span className="inline-block px-2 py-0.5 bg-slate-500/20 text-slate-400 text-xs rounded-full">Low</span>
                                      )}
                                    </div>
                                    <p className="font-medium text-white mt-2 mb-1">{rec.title}</p>
                                    {rec.description && (
                                      <p className="text-sm text-slate-400">{rec.description}</p>
                                    )}
                                    {rec.actionable && (
                                      <p className="text-sm text-indigo-400 mt-2">→ {rec.actionable}</p>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Scan History */}
            {project.scans.length > 1 && (
              <>
                <h2 className="text-2xl font-bold mb-6">Scan History</h2>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-5 py-3 text-left text-sm font-semibold text-slate-400">Date</th>
                        <th className="px-5 py-3 text-left text-sm font-semibold text-slate-400">Score</th>
                        <th className="px-5 py-3 text-left text-sm font-semibold text-slate-400">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.scans.slice(0, 10).map((scan, index) => {
                        const prevScan = project.scans[index + 1]
                        const change = prevScan ? scan.score - prevScan.score : 0
                        return (
                          <tr key={scan.id} className="border-b border-slate-700/50 last:border-0">
                            <td className="px-5 py-3 text-sm text-slate-300">
                              {new Date(scan.scannedAt).toLocaleString()}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`font-bold ${getScoreColor(scan.score, 100)}`}>
                                {scan.score}/100
                              </span>
                            </td>
                            <td className="px-5 py-3 text-sm">
                              {index < project.scans.length - 1 ? (
                                <span
                                  className={
                                    change > 0
                                      ? 'text-emerald-400'
                                      : change < 0
                                      ? 'text-red-400'
                                      : 'text-slate-500'
                                  }
                                >
                                  {change > 0 ? '+' : ''}
                                  {change}
                                </span>
                              ) : (
                                <span className="text-slate-500">Initial</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        ) : (
          /* No scans yet */
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
            <Rocket className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Scans Yet</h2>
            <p className="text-slate-400 mb-6">
              Run your first scan to get a comprehensive readiness score.
            </p>
            <button
              onClick={handleRescan}
              disabled={scanning}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
            >
              {scanning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Run First Scan
                </>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
