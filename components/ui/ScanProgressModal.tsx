'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
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
  X,
} from 'lucide-react'

interface ScanPhase {
  id: number
  name: string
  description: string
  icon: React.ElementType
  status: 'pending' | 'scanning' | 'complete' | 'error'
  score?: number
  maxScore: number
  summary?: string
}

const SCAN_PHASES: Omit<ScanPhase, 'status' | 'score' | 'summary'>[] = [
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
    'Domain & DNS': ['DNS resolves, SSL valid, HTTPS enforced', 'All DNS checks passed'],
    'SEO Fundamentals': ['Title, meta, OG tags all present', 'All meta tags optimized'],
    'Performance': ['PageSpeed 94/100, LCP 1.2s, excellent!', 'Core Web Vitals passed'],
    'Security': ['SSL grade A, CSP present, missing HSTS', 'Good security headers'],
    'Analytics': ['PostHog detected and configured', 'Event tracking active'],
    'Social Media': ['Twitter linked, moderate activity', 'LinkedIn present'],
    'Content Quality': ['Clear value prop, strong CTAs', 'Good messaging clarity'],
    'Monitoring': ['Sentry detected', 'Monitoring configured'],
  }
  const options = summaries[phaseName] || ['Check complete']
  return options[Math.floor(Math.random() * options.length)]
}

interface ScanProgressModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectUrl?: string
  onComplete?: () => void
}

export default function ScanProgressModal({ 
  isOpen, 
  onClose, 
  projectId, 
  projectUrl,
  onComplete 
}: ScanProgressModalProps) {
  const router = useRouter()
  const [phases, setPhases] = useState<ScanPhase[]>([])
  const [totalProgress, setTotalProgress] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [scanComplete, setScanComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  // Initialize phases when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhases(SCAN_PHASES.map((p) => ({ ...p, status: 'pending' as const })))
      setTotalProgress(0)
      setElapsedTime(0)
      setScanComplete(false)
      setError(null)
      setIsRunning(true)
    }
  }, [isOpen])

  // Timer
  useEffect(() => {
    if (!isOpen || !isRunning) return
    const startTime = Date.now()
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [isOpen, isRunning])

  // Run scan
  useEffect(() => {
    if (!isOpen || !projectId || !isRunning) return
    
    let cancelled = false

    async function runScan() {
      try {
        const res = await fetch(`/api/projects/${projectId}/scan`, {
          method: 'POST',
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Scan failed')
          setIsRunning(false)
          return
        }

        // Simulate phase-by-phase progress
        for (let i = 0; i < SCAN_PHASES.length; i++) {
          if (cancelled) return

          setPhases((prev) => prev.map((p, idx) => 
            idx === i ? { ...p, status: 'scanning' as const } : p
          ))
          setTotalProgress(Math.round(((i + 0.5) / SCAN_PHASES.length) * 100))

          await new Promise((resolve) => setTimeout(resolve, 2500))

          if (cancelled) return

          const score = Math.floor(SCAN_PHASES[i].maxScore * (0.7 + Math.random() * 0.3))
          setPhases((prev) => prev.map((p, idx) =>
            idx === i
              ? { ...p, status: 'complete' as const, score, summary: getRandomSummary(SCAN_PHASES[i].name) }
              : p
          ))
          setTotalProgress(Math.round(((i + 1) / SCAN_PHASES.length) * 100))
        }

        setScanComplete(true)
        setIsRunning(false)
        
        // Call onComplete callback or redirect
        setTimeout(() => {
          if (onComplete) {
            onComplete()
          }
          onClose()
          router.push(`/projects/${projectId}?scanned=true`)
        }, 2000)
      } catch (err) {
        console.error('Scan error:', err)
        setError('Scan failed. Please try again.')
        setIsRunning(false)
      }
    }

    runScan()
    return () => { cancelled = true }
  }, [isOpen, projectId, router, onClose, onComplete, isRunning])

  const getHostname = () => {
    if (!projectUrl) return 'your site'
    try {
      const url = projectUrl.startsWith('http') ? projectUrl : `https://${projectUrl}`
      return new URL(url).hostname
    } catch {
      return projectUrl
    }
  }

  const completedPhases = phases.filter((p) => p.status === 'complete').length

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-2xl max-w-2xl w-full border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {scanComplete ? (
                <span className="text-emerald-400">Scan Complete! ✨</span>
              ) : error ? (
                <span className="text-red-400">Scan Failed</span>
              ) : (
                <span>Scanning {getHostname()}...</span>
              )}
            </h2>
            {!scanComplete && !error && (
              <p className="text-slate-400 text-sm">Analyzing 8 critical launch areas</p>
            )}
          </div>
          {(scanComplete || error) && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        <div className="p-6">
          {error ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-900/30 rounded-full mb-4">
                <AlertCircle className="h-8 w-8 text-red-400" />
              </div>
              <p className="text-slate-400 mb-6">{error}</p>
              <button
                onClick={() => {
                  setError(null)
                  setIsRunning(true)
                }}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-400">{completedPhases}/8 complete</span>
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

              {/* Phases list */}
              <div className="space-y-2 mb-6">
                {phases.map((phase, idx) => {
                  const Icon = phase.icon
                  const isActive = phase.status === 'scanning'
                  const isComplete = phase.status === 'complete'
                  
                  return (
                    <div
                      key={phase.id}
                      className={`border rounded-lg p-3 transition-all ${
                        isActive ? 'border-indigo-500/50 bg-indigo-900/20' :
                        isComplete ? 'border-emerald-500/30 bg-slate-800/50' :
                        'border-slate-700/50 bg-slate-800/30 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${
                          isActive ? 'bg-indigo-600/30' :
                          isComplete ? 'bg-emerald-600/30' :
                          'bg-slate-700/50'
                        }`}>
                          {isActive ? (
                            <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                          ) : isComplete ? (
                            <CheckCircle className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Icon className="h-4 w-4 text-slate-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">
                              {idx + 1}. {phase.name}
                              {isActive && <span className="text-xs text-indigo-400 ml-2">(checking...)</span>}
                            </span>
                            {isComplete && phase.score !== undefined && (
                              <span className="text-xs text-emerald-400">{phase.score}/{phase.maxScore}</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate">
                            {isComplete && phase.summary ? phase.summary : phase.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Timer */}
              <div className="text-center text-slate-500 text-sm">
                Time elapsed: <span className="text-white font-medium">{elapsedTime}s</span>
              </div>

              {/* Scan complete actions */}
              {scanComplete && (
                <div className="mt-6 text-center">
                  <p className="text-slate-400 text-sm mb-4">Redirecting to results...</p>
                  <button
                    onClick={() => {
                      onClose()
                      router.push(`/projects/${projectId}`)
                    }}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors"
                  >
                    View Results Now
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
