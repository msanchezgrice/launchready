'use client'

import { useEffect, useState, use } from 'react'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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
  Github,
  Triangle,
  Settings,
  Shield,
  Bug,
  Package,
  FileDown,
  Loader2,
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
  githubRepo?: string
  vercelProject?: string
  createdAt: string
  scans: Scan[]
}

interface UserIntegrations {
  githubConnected: boolean
  githubUsername: string | null
  vercelConnected: boolean
  vercelUsername: string | null
}

interface GitHubScanResult {
  connected: boolean
  repoFound: boolean
  score: number
  maxScore: number
  findings: Array<{
    type: 'success' | 'warning' | 'error'
    category: string
    message: string
    details?: string
    file?: string
  }>
  recommendations: Array<{
    priority: string
    title: string
    description: string
    actionable: string
  }>
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const searchParams = useSearchParams()
  const [project, setProject] = useState<Project | null>(null)
  const [integrations, setIntegrations] = useState<UserIntegrations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set())
  const [githubScan, setGithubScan] = useState<GitHubScanResult | null>(null)
  const [githubScanning, setGithubScanning] = useState(false)
  const [showGithubModal, setShowGithubModal] = useState(false)
  const [githubRepoUrl, setGithubRepoUrl] = useState('')
  const [savingRepo, setSavingRepo] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [exportingPdf, setExportingPdf] = useState(false)

  // Check for success messages
  useEffect(() => {
    const github = searchParams.get('github')
    const vercel = searchParams.get('vercel')
    if (github === 'connected') {
      setSuccessMessage('GitHub connected successfully!')
      window.history.replaceState({}, '', `/projects/${resolvedParams.id}`)
    }
    if (vercel === 'connected') {
      setSuccessMessage('Vercel connected successfully!')
      window.history.replaceState({}, '', `/projects/${resolvedParams.id}`)
    }
  }, [searchParams, resolvedParams.id])

  useEffect(() => {
    fetchProject()
    fetchUserIntegrations()
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

  async function fetchUserIntegrations() {
    try {
      const res = await fetch('/api/user/settings')
      if (res.ok) {
        const data = await res.json()
        setIntegrations({
          githubConnected: data.user.githubConnected,
          githubUsername: data.user.githubUsername,
          vercelConnected: data.user.vercelConnected,
          vercelUsername: data.user.vercelUsername,
        })
      }
    } catch (err) {
      console.error('Failed to fetch integrations:', err)
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

  async function handleGitHubScan() {
    if (!integrations?.githubConnected || !project?.githubRepo) return
    setGithubScanning(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${resolvedParams.id}/github-scan`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || data.message || 'GitHub scan failed')
      }
      const data = await res.json()
      setGithubScan(data.result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GitHub scan failed')
    } finally {
      setGithubScanning(false)
    }
  }

  async function handleSaveGithubRepo() {
    setSavingRepo(true)
    try {
      const res = await fetch(`/api/projects/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubRepo: githubRepoUrl }),
      })
      if (!res.ok) throw new Error('Failed to save')
      await fetchProject()
      setShowGithubModal(false)
      setSuccessMessage('GitHub repo saved!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save repo')
    } finally {
      setSavingRepo(false)
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true)
    try {
      const res = await fetch(`/api/projects/${resolvedParams.id}/export-pdf`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to export PDF')
      }
      
      // Download the PDF
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `launchready-${project?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      setSuccessMessage('PDF exported successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export PDF')
    } finally {
      setExportingPdf(false)
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
    if (Array.isArray(data)) return data
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data)
        return Array.isArray(parsed) ? parsed : fallback
      } catch {
        return fallback
      }
    }
    if (data && typeof data === 'object') return [data]
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

            {/* Success Message */}
            {successMessage && (
              <div className="mb-6 p-4 bg-emerald-900/20 border border-emerald-600/30 rounded-lg flex items-center justify-between">
                <p className="text-emerald-200 flex items-center gap-2">
                  <Check className="h-5 w-5" />
                  {successMessage}
                </p>
                <button onClick={() => setSuccessMessage('')} className="text-emerald-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-4 mb-8">
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
              
              {integrations?.githubConnected && project.githubRepo && (
                <button
                  onClick={handleGitHubScan}
                  disabled={githubScanning}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {githubScanning ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Scanning Repo...
                    </>
                  ) : (
                    <>
                      <Github className="h-4 w-4" />
                      Scan GitHub Repo
                    </>
                  )}
                </button>
              )}

              {/* PDF Export Button */}
              <button
                onClick={handleExportPdf}
                disabled={exportingPdf || !latestScan}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors flex items-center gap-2"
                title="Download PDF Report"
              >
                {exportingPdf ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    Export PDF
                  </>
                )}
              </button>
            </div>

            {/* GitHub & Vercel Integration Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* GitHub Integration */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-700 rounded-lg">
                      <Github className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">GitHub Integration</h3>
                      <p className="text-sm text-slate-400">Deep code analysis</p>
                    </div>
                  </div>
                  {integrations?.githubConnected ? (
                    <span className="px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded-full text-xs flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Connected
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-slate-700 text-slate-400 rounded-full text-xs">
                      Not Connected
                    </span>
                  )}
                </div>

                {integrations?.githubConnected ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-300">
                      <span className="text-slate-500">Account:</span> @{integrations.githubUsername}
                    </p>
                    {project.githubRepo ? (
                      <p className="text-sm text-slate-300 truncate">
                        <span className="text-slate-500">Repo:</span> {project.githubRepo}
                      </p>
                    ) : (
                      <button
                        onClick={() => setShowGithubModal(true)}
                        className="text-sm text-indigo-400 hover:text-indigo-300"
                      >
                        + Set repository for this project
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-400">
                      Unlock deep code scanning:
                    </p>
                    <ul className="text-sm text-slate-400 space-y-1">
                      <li className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-red-400" />
                        Secret detection
                      </li>
                      <li className="flex items-center gap-2">
                        <Bug className="h-4 w-4 text-amber-400" />
                        Debug statement finder
                      </li>
                      <li className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-blue-400" />
                        Dependency audit
                      </li>
                    </ul>
                    <Link
                      href="/settings"
                      className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Connect in Settings
                    </Link>
                  </div>
                )}
              </div>

              {/* Vercel Integration */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-700 rounded-lg">
                      <Triangle className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Vercel Integration</h3>
                      <p className="text-sm text-slate-400">Deployment analysis</p>
                    </div>
                  </div>
                  {integrations?.vercelConnected ? (
                    <span className="px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded-full text-xs flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Connected
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-slate-700 text-slate-400 rounded-full text-xs">
                      Not Connected
                    </span>
                  )}
                </div>

                {integrations?.vercelConnected ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-300">
                      <span className="text-slate-500">Account:</span> {integrations.vercelUsername}
                    </p>
                    {project.vercelProject && (
                      <p className="text-sm text-slate-300">
                        <span className="text-slate-500">Project:</span> {project.vercelProject}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-400">
                      Unlock deployment insights:
                    </p>
                    <ul className="text-sm text-slate-400 space-y-1">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400" />
                        Environment variables
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400" />
                        Domain configuration
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400" />
                        Build & deploy status
                      </li>
                    </ul>
                    <Link
                      href="/settings"
                      className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Connect in Settings
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* GitHub Scan Results */}
            {githubScan && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Github className="h-5 w-5" />
                    GitHub Repository Analysis
                  </h3>
                  <span className={`text-2xl font-bold ${
                    githubScan.score >= 80 ? 'text-emerald-400' :
                    githubScan.score >= 60 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {githubScan.score}/{githubScan.maxScore}
                  </span>
                </div>

                <div className="space-y-3">
                  {githubScan.findings.map((finding, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <span className={
                        finding.type === 'success' ? 'text-emerald-400' :
                        finding.type === 'warning' ? 'text-amber-400' : 'text-red-400'
                      }>
                        {finding.type === 'success' ? '✓' : finding.type === 'warning' ? '⚠' : '✗'}
                      </span>
                      <div>
                        <span className="text-slate-300">{finding.message}</span>
                        {finding.file && (
                          <span className="text-slate-500 ml-2">({finding.file})</span>
                        )}
                        {finding.details && (
                          <p className="text-xs text-slate-500 mt-1">{finding.details}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {githubScan.recommendations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <h4 className="text-sm font-semibold text-slate-400 mb-3">💡 Recommendations</h4>
                    <div className="space-y-2">
                      {githubScan.recommendations.map((rec, idx) => (
                        <div key={idx} className="bg-slate-700/30 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              rec.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                              rec.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>
                              {rec.priority}
                            </span>
                            <span className="font-medium text-white">{rec.title}</span>
                          </div>
                          <p className="text-sm text-slate-400">{rec.actionable}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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

                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-slate-700 pt-4">
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

      {/* GitHub Repo Modal */}
      {showGithubModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Github className="h-6 w-6" />
                Set GitHub Repository
              </h2>
              <button
                onClick={() => setShowGithubModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Repository (owner/repo)</label>
                <input
                  type="text"
                  value={githubRepoUrl || project?.githubRepo || ''}
                  onChange={(e) => setGithubRepoUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-indigo-500"
                  placeholder="username/repository"
                />
                <p className="text-xs text-slate-500 mt-1">Enter in format: owner/repo (e.g., msanchezgrice/launchready)</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowGithubModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveGithubRepo}
                  disabled={savingRepo || !githubRepoUrl}
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors"
                >
                  {savingRepo ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
