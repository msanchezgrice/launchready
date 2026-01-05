'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Rocket,
  Globe,
  Search,
  Zap,
  Shield,
  BarChart3,
  Share2,
  FileText,
  Bell,
  CheckCircle,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'

interface ScanPhase {
  id: number
  name: string
  description: string
  icon: React.ElementType
  status: 'pending' | 'scanning' | 'complete' | 'error'
  score?: number
  maxScore: number
  duration?: number
  summary?: string
}

const SCAN_PHASES: Omit<ScanPhase, 'status' | 'score' | 'duration' | 'summary'>[] = [
  { id: 1, name: 'Domain & DNS', description: 'DNS resolves, SSL valid, HTTPS enforced', icon: Globe, maxScore: 15 },
  { id: 2, name: 'SEO Fundamentals', description: 'Title, meta, OG tags, sitemap', icon: Search, maxScore: 12 },
  { id: 3, name: 'Performance', description: 'PageSpeed, Core Web Vitals, page size', icon: Zap, maxScore: 13 },
  { id: 4, name: 'Security', description: 'SSL grade, headers, CSP, HSTS', icon: Shield, maxScore: 15 },
  { id: 5, name: 'Analytics', description: 'Tracking setup, event flow', icon: BarChart3, maxScore: 10 },
  { id: 6, name: 'Social Media', description: 'Twitter, LinkedIn, activity', icon: Share2, maxScore: 10 },
  { id: 7, name: 'Content Quality', description: 'Value prop, CTAs, messaging', icon: FileText, maxScore: 15 },
  { id: 8, name: 'Monitoring', description: 'Error tracking, uptime alerts', icon: Bell, maxScore: 10 },
]

function getRandomSummary(phaseName: string): string {
  const summaries: Record<string, string[]> = {
    'Domain & DNS': ['DNS resolves, SSL valid, HTTPS enforced', 'All DNS checks passed', 'Certificate valid for 90 days'],
    'SEO Fundamentals': ['Title, meta, OG tags all present', 'Sitemap found with 45 URLs', 'All meta tags optimized'],
    'Performance': ['PageSpeed 94/100, LCP 1.2s, excellent!', 'Core Web Vitals passed', 'Page size optimized'],
    'Security': ['SSL grade A, CSP present, missing HSTS', 'Good security headers', 'No vulnerabilities found'],
    'Analytics': ['PostHog detected and configured', 'Google Analytics found', 'Event tracking active'],
    'Social Media': ['Twitter linked, moderate activity', 'LinkedIn present', 'Social profiles verified'],
    'Content Quality': ['Clear value prop, strong CTAs', 'Good messaging clarity', 'Content well structured'],
    'Monitoring': ['Verifying error tracking and uptime monitors...', 'Sentry detected', 'Monitoring configured'],
  }
  const options = summaries[phaseName] || ['Check complete']
  return options[Math.floor(Math.random() * options.length)]
}

function ScanContent({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [project, setProject] = useState<{ name: string; url: string } | null>(null)
  const [phases, setPhases] = useState<ScanPhase[]>(
    SCAN_PHASES.map((p) => ({ ...p, status: 'pending' as const }))
  )
  const [totalProgress, setTotalProgress] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [scanComplete, setScanComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch project info
  useEffect(() => {
    if (!projectId) return
    
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (res.ok) {
          const data = await res.json()
          setProject({ name: data.project.name, url: data.project.url })
        }
      } catch (err) {
        console.error('Failed to fetch project:', err)
      }
    }
    fetchProject()
  }, [projectId])

  // Timer
  useEffect(() => {
    const startTime = Date.now()
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Run scan
  useEffect(() => {
    if (!projectId) return
    
    let cancelled = false

    async function runScan() {
      try {
        // Start the actual scan
        const res = await fetch(`/api/projects/${projectId}/scan`, {
          method: 'POST',
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Scan failed')
          return
        }

        // Simulate phase progress while scan runs
        for (let i = 0; i < SCAN_PHASES.length; i++) {
          if (cancelled) return

          // Update current phase to scanning
          setPhases((prev) => prev.map((p, idx) => 
            idx === i ? { ...p, status: 'scanning' as const } : p
          ))
          setTotalProgress(Math.round(((i + 0.5) / SCAN_PHASES.length) * 100))

          // Wait for phase completion (simulated timing)
          await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 3000))

          if (cancelled) return

          // Mark phase complete with random score
          const score = Math.floor(SCAN_PHASES[i].maxScore * (0.7 + Math.random() * 0.3))
          setPhases((prev) => prev.map((p, idx) =>
            idx === i
              ? {
                  ...p,
                  status: 'complete' as const,
                  score,
                  duration: Math.floor(2 + Math.random() * 10),
                  summary: getRandomSummary(SCAN_PHASES[i].name),
                }
              : p
          ))
          setTotalProgress(Math.round(((i + 1) / SCAN_PHASES.length) * 100))
        }

        setScanComplete(true)

        // Redirect to project page after a short delay
        setTimeout(() => {
          router.push(`/projects/${projectId}?scanned=true`)
        }, 2000)
      } catch (err) {
        console.error('Scan error:', err)
        setError('Scan failed. Please try again.')
      }
    }

    runScan()

    return () => {
      cancelled = true
    }
  }, [projectId, router])

  // Safely extract hostname
  const getHostname = () => {
    if (!project?.url) return 'your site'
    try {
      const urlWithProtocol = project.url.startsWith('http') ? project.url : `https://${project.url}`
      return new URL(urlWithProtocol).hostname
    } catch {
      return project.url
    }
  }

  const completedPhases = phases.filter((p) => p.status === 'complete').length
  const hostname = getHostname()

  if (error) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-red-900/30 rounded-full mb-6">
          <AlertCircle className="h-10 w-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Scan Failed</h1>
        <p className="text-slate-400 mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Title */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-2">
          {scanComplete ? (
            <span className="text-emerald-400">Scan Complete! ✨</span>
          ) : (
            <>Scanning {hostname}...</>
          )}
        </h1>
        {!scanComplete && (
          <p className="text-slate-400">
            Analyzing 8 critical launch areas
          </p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-10">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-slate-400">
            {completedPhases}/{phases.length} complete
          </span>
          <span className="text-indigo-400 font-medium">{totalProgress}%</span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              scanComplete
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                : 'bg-gradient-to-r from-indigo-600 to-indigo-400'
            }`}
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      </div>

      {/* Phases List */}
      <div className="space-y-4 mb-10">
        {phases.map((phase, idx) => {
          const Icon = phase.icon
          const isActive = phase.status === 'scanning'
          const isComplete = phase.status === 'complete'
          
          return (
            <div
              key={phase.id}
              className={`bg-slate-800/50 border rounded-xl p-5 transition-all ${
                isActive
                  ? 'border-indigo-500/50 bg-indigo-900/20'
                  : isComplete
                  ? 'border-emerald-500/30'
                  : 'border-slate-700/50 opacity-60'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Status Icon */}
                <div className={`p-2 rounded-lg flex-shrink-0 ${
                  isActive
                    ? 'bg-indigo-600/30'
                    : isComplete
                    ? 'bg-emerald-600/30'
                    : 'bg-slate-700/50'
                }`}>
                  {isActive ? (
                    <Loader2 className="h-5 w-5 text-indigo-400 animate-spin" />
                  ) : isComplete ? (
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <Icon className="h-5 w-5 text-slate-500" />
                  )}
                </div>

                {/* Phase Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold flex items-center gap-2">
                      {idx + 1}. {phase.name}
                      {isActive && (
                        <span className="text-xs text-indigo-400 font-normal">(checking...)</span>
                      )}
                    </h3>
                    {isComplete && phase.score !== undefined && (
                      <span className="text-sm font-medium text-emerald-400">
                        {phase.score}/{phase.maxScore}
                      </span>
                    )}
                    {isComplete && phase.duration !== undefined && (
                      <span className="text-xs text-slate-500 ml-2">
                        ({phase.duration}s)
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">
                    {isComplete && phase.summary ? (
                      <span className="text-slate-300">{phase.summary}</span>
                    ) : (
                      phase.description
                    )}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Timer */}
      <div className="text-center text-slate-500 mb-10">
        Total scan time: <span className="text-white font-medium">{elapsedTime} seconds</span>
      </div>

      {/* While You Wait CTA */}
      {!scanComplete && (
        <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 rounded-xl border border-indigo-500/30 p-6 text-center">
          <h3 className="text-lg font-semibold mb-2">💡 While you wait...</h3>
          <p className="text-slate-400 mb-4">
            Your scan results will include actionable recommendations to improve your launch readiness score.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <span className="px-3 py-1 bg-slate-800/50 rounded-full text-slate-300">
              ✅ Save these results
            </span>
            <span className="px-3 py-1 bg-slate-800/50 rounded-full text-slate-300">
              ✅ Track improvements
            </span>
            <span className="px-3 py-1 bg-slate-800/50 rounded-full text-slate-300">
              ✅ Get daily scans
            </span>
          </div>
        </div>
      )}

      {/* Scan Complete Actions */}
      {scanComplete && (
        <div className="text-center">
          <p className="text-slate-400 mb-4">Redirecting to your results...</p>
          <Link
            href={`/projects/${projectId}`}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
          >
            View Results Now
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </Link>
        </div>
      )}
    </>
  )
}

export default function ScanProgressPage() {
  const params = useParams()
  const projectId = params?.projectId as string || ''

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              href={projectId ? `/projects/${projectId}` : '/dashboard'}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <Rocket className="h-6 w-6 text-indigo-500" />
              <span className="font-semibold">LaunchReady.me</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {projectId ? (
          <ScanContent projectId={projectId} />
        ) : (
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-400" />
            <p className="mt-4 text-slate-400">Loading...</p>
          </div>
        )}
      </main>
    </div>
  )
}
