'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { UserButton } from '@clerk/nextjs'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Rocket,
  Star,
  Crown,
  Building,
  ArrowRight,
  Settings,
  RefreshCw,
  Trash2,
  Plus,
  ExternalLink,
  Clock,
  Zap,
  X,
  CheckCircle,
  AlertCircle,
  LayoutGrid,
  List,
  SortAsc,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileDown,
  Bell,
  Github,
  ChevronDown,
} from 'lucide-react'
import UpgradeModal from '@/components/ui/UpgradeModal'
import { ProjectCardSkeleton } from '@/components/ui/Skeleton'
import ScanProgressIndicator from '@/components/ui/ScanProgressIndicator'
import ScanProgressModal from '@/components/ui/ScanProgressModal'
import { validateField, normalizeUrl, normalizeGitHubRepo } from '@/lib/validation'

interface Project {
  id: string
  name: string
  url: string
  createdAt: string
  autoScanEnabled?: boolean
  autoScanSchedule?: string
  scans: Array<{
    id: string
    score: number
    scannedAt: string
  }>
}

interface UserPlan {
  plan: string
  projectCount: number
  maxProjects: number
  canScan: boolean
  nextScanTime?: string
  stripeCustomerId?: string
}

interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  message?: string
}

interface UserIntegrations {
  githubConnected: boolean
  githubUsername: string | null
  vercelConnected: boolean
  vercelUsername: string | null
}

interface GitHubRepo {
  fullName: string
  name: string
  description: string | null
  url: string
  private: boolean
  language: string | null
}

type SortOption = 'latest' | 'score' | 'name'
type ViewMode = 'grid' | 'list'

const PLAN_BADGES: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  free: { icon: Rocket, label: 'Free', color: 'bg-slate-600' },
  pro: { icon: Star, label: 'Pro', color: 'bg-indigo-600' },
  pro_plus: { icon: Crown, label: 'Pro Plus', color: 'bg-purple-600' },
  enterprise: { icon: Building, label: 'Enterprise', color: 'bg-amber-600' },
}

export default function DashboardClient() {
  const [projects, setProjects] = useState<Project[]>([])
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeReason, setUpgradeReason] = useState<'project_limit' | 'scan_limit' | 'feature'>('project_limit')
  const [newProject, setNewProject] = useState({ name: '', url: '', githubRepo: '', autoScan: false })
  const [formErrors, setFormErrors] = useState<{ name?: string; url?: string; github?: string }>({})
  const [addingProject, setAddingProject] = useState(false)
  const [scanning, setScanning] = useState<string | null>(null)
  const [scanModalProject, setScanModalProject] = useState<{ id: string; url: string } | null>(null)
  const [manageLoading, setManageLoading] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortOption>('latest')
  const [integrations, setIntegrations] = useState<UserIntegrations | null>(null)
  const [userRepos, setUserRepos] = useState<GitHubRepo[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  // Toast helpers
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts((prev) => [...prev, { ...toast, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Fetch user integrations status
  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch('/api/user/settings')
      if (res.ok) {
        const data = await res.json()
        setIntegrations(data)
      }
    } catch (err) {
      console.error('Failed to fetch integrations:', err)
    }
  }, [])

  // Fetch user's GitHub repos
  const fetchUserRepos = useCallback(async () => {
    if (loadingRepos || userRepos.length > 0) return
    setLoadingRepos(true)
    try {
      const res = await fetch('/api/user/repos')
      if (res.ok) {
        const data = await res.json()
        setUserRepos(data.repos || [])
      }
    } catch (err) {
      console.error('Failed to fetch repos:', err)
    } finally {
      setLoadingRepos(false)
    }
  }, [loadingRepos, userRepos.length])

  // Check for checkout success
  useEffect(() => {
    const checkout = searchParams.get('checkout')
    const plan = searchParams.get('plan')
    if (checkout === 'success' && plan) {
      addToast({
        type: 'success',
        title: `Welcome to ${plan.charAt(0).toUpperCase() + plan.slice(1)}!`,
        message: 'Your subscription is now active.',
      })
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [searchParams, addToast])

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      setProjects(data.projects || [])
      setUserPlan(data.userPlan || null)
    } catch (err) {
      console.error('Error fetching projects:', err)
      addToast({
        type: 'error',
        title: 'Failed to load projects',
        message: 'Please refresh the page to try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  // Sort projects
  const sortedProjects = useMemo(() => {
    const sorted = [...projects]
    switch (sortBy) {
      case 'latest':
        return sorted.sort((a, b) => {
          const aDate = a.scans[0]?.scannedAt || a.createdAt
          const bDate = b.scans[0]?.scannedAt || b.createdAt
          return new Date(bDate).getTime() - new Date(aDate).getTime()
        })
      case 'score':
        return sorted.sort((a, b) => {
          const aScore = a.scans[0]?.score || 0
          const bScore = b.scans[0]?.score || 0
          return bScore - aScore
        })
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name))
      default:
        return sorted
    }
  }, [projects, sortBy])

  // Portfolio stats
  const portfolioStats = useMemo(() => {
    const projectsWithScores = projects.filter((p) => p.scans.length > 0)
    const scores = projectsWithScores.map((p) => p.scans[0].score)
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    
    const distribution = {
      excellent: scores.filter((s) => s >= 90).length,
      good: scores.filter((s) => s >= 80 && s < 90).length,
      fair: scores.filter((s) => s >= 70 && s < 80).length,
      poor: scores.filter((s) => s >= 60 && s < 70).length,
      critical: scores.filter((s) => s < 60).length,
    }

    // Count phases with issues
    const passed = scores.filter((s) => s >= 80).length
    const warnings = scores.filter((s) => s >= 60 && s < 80).length
    const failed = scores.filter((s) => s < 60).length

    return { avgScore, distribution, passed, warnings, failed, total: projects.length }
  }, [projects])

  function handleAddProjectClick() {
    if (userPlan && userPlan.projectCount >= userPlan.maxProjects && userPlan.maxProjects !== -1) {
      setUpgradeReason('project_limit')
      setShowUpgradeModal(true)
    } else {
      setShowAddModal(true)
      fetchIntegrations() // Fetch integrations when modal opens
      if (userPlan?.plan !== 'free') {
        fetchUserRepos() // Pre-fetch repos for Pro users
      }
    }
  }

  async function handleAddProject(e: React.FormEvent) {
    e.preventDefault()
    
    // Validate all fields
    const nameValidation = validateField(newProject.name, 'name')
    const urlValidation = validateField(newProject.url, 'url')
    const githubValidation = validateField(newProject.githubRepo, 'github')
    
    const errors: { name?: string; url?: string; github?: string } = {}
    if (!nameValidation.valid) errors.name = nameValidation.error
    if (!urlValidation.valid) errors.url = urlValidation.error
    if (!githubValidation.valid) errors.github = githubValidation.error
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    
    setAddingProject(true)
    setFormErrors({})

    try {
      // Normalize inputs before sending
      const normalizedData = {
        ...newProject,
        url: normalizeUrl(newProject.url),
        githubRepo: newProject.githubRepo ? normalizeGitHubRepo(newProject.githubRepo) : '',
      }
      
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedData),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.upgrade) {
          setShowAddModal(false)
          setUpgradeReason('project_limit')
          setShowUpgradeModal(true)
        } else {
          addToast({
            type: 'error',
            title: 'Failed to create project',
            message: data.error || 'Please try again.',
          })
        }
        return
      }

      setNewProject({ name: '', url: '', githubRepo: '', autoScan: false })
      setShowAddModal(false)
      addToast({
        type: 'success',
        title: 'Project created!',
        message: 'Running initial scan...',
      })
      fetchProjects()
    } catch {
      addToast({
        type: 'error',
        title: 'Failed to create project',
        message: 'Please check your connection and try again.',
      })
    } finally {
      setAddingProject(false)
    }
  }

  function handleScanProject(projectId: string) {
    if (userPlan?.plan === 'free' && !userPlan?.canScan) {
      setUpgradeReason('scan_limit')
      setShowUpgradeModal(true)
      return
    }

    // Find the project to get its URL
    const project = projects.find(p => p.id === projectId)
    if (project) {
      setScanModalProject({ id: projectId, url: project.url })
    }
  }

  async function handleDeleteProject(projectId: string) {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return

    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      
      addToast({
        type: 'success',
        title: 'Project deleted',
      })
      fetchProjects()
    } catch {
      addToast({
        type: 'error',
        title: 'Failed to delete project',
        message: 'Please try again.',
      })
    }
  }

  async function handleManageSubscription() {
    setManageLoading(true)
    try {
      const res = await fetch('/api/customer-portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        addToast({
          type: 'error',
          title: 'Unable to open billing',
          message: 'Please try again later.',
        })
      }
    } catch {
      addToast({
        type: 'error',
        title: 'Failed to open billing',
        message: 'Please try again.',
      })
    } finally {
      setManageLoading(false)
    }
  }

  const planBadge = userPlan ? PLAN_BADGES[userPlan.plan] || PLAN_BADGES.free : PLAN_BADGES.free
  const PlanIcon = planBadge.icon

  // SSE callback handlers
  const handleJobComplete = useCallback((jobId: string) => {
    console.log('[SSE] Job completed:', jobId)
    addToast({
      type: 'success',
      title: 'Scan complete!',
      message: 'Your project has been scanned successfully.',
    })
    fetchProjects()
  }, [addToast])

  const handleJobFailed = useCallback((jobId: string, error: string) => {
    console.log('[SSE] Job failed:', jobId, error)
    addToast({
      type: 'error',
      title: 'Scan failed',
      message: error || 'Please try again.',
    })
  }, [addToast])

  // Helper to get score color
  function getScoreColor(score: number) {
    if (score >= 80) return { text: 'text-emerald-400', bg: 'bg-emerald-500', dot: '🟢' }
    if (score >= 60) return { text: 'text-amber-400', bg: 'bg-amber-500', dot: '🟡' }
    return { text: 'text-red-400', bg: 'bg-red-500', dot: '🔴' }
  }

  // Helper to format relative time
  function formatRelativeTime(date: string) {
    const now = new Date()
    const then = new Date(date)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return `${Math.floor(diffDays / 7)}w ago`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900">
        <header className="border-b border-slate-800 bg-slate-900/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-4">
                <div className="h-8 w-8 bg-slate-700 rounded animate-pulse" />
                <div className="h-6 w-36 bg-slate-700 rounded animate-pulse" />
                <div className="h-6 w-16 bg-slate-700 rounded-full animate-pulse" />
              </div>
              <div className="flex items-center gap-4">
                <div className="h-4 w-16 bg-slate-700 rounded animate-pulse" />
                <div className="h-9 w-9 bg-slate-700 rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div>
                <div className="h-9 w-48 bg-slate-700 rounded animate-pulse mb-2" />
                <div className="h-4 w-32 bg-slate-700 rounded animate-pulse" />
              </div>
              <div className="flex gap-3">
                <div className="h-10 w-36 bg-slate-700 rounded-lg animate-pulse" />
                <div className="h-10 w-32 bg-slate-700 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ProjectCardSkeleton />
            <ProjectCardSkeleton />
            <ProjectCardSkeleton />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${
              toast.type === 'success'
                ? 'bg-emerald-900/90 border-emerald-500/50'
                : toast.type === 'error'
                ? 'bg-red-900/90 border-red-500/50'
                : 'bg-blue-900/90 border-blue-500/50'
            } border rounded-lg p-4 shadow-2xl backdrop-blur-sm animate-slide-in-right flex items-start gap-3`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white">{toast.title}</p>
              {toast.message && (
                <p className="text-sm opacity-80 mt-1">{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/60 hover:text-white transition-colors flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Rocket className="h-8 w-8 text-indigo-500" />
                <span className="text-xl font-bold hidden sm:block">LaunchReady.me</span>
              </Link>
              <span className={`px-2 py-1 ${planBadge.color} rounded-full text-xs font-medium flex items-center gap-1`}>
                <PlanIcon className="h-3 w-3" />
                {planBadge.label}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link
                href="/pricing"
                className="text-slate-300 hover:text-white transition-colors text-sm hidden sm:block"
              >
                Pricing
              </Link>
              <Link
                href="/settings"
                className="text-slate-300 hover:text-white transition-colors text-sm flex items-center gap-1"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
              {userPlan?.stripeCustomerId && (
                <button
                  onClick={handleManageSubscription}
                  disabled={manageLoading}
                  className="text-slate-300 hover:text-white transition-colors text-sm flex items-center gap-1"
                >
                  <span className="hidden sm:inline">{manageLoading ? 'Loading...' : 'Billing'}</span>
                </button>
              )}
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">My Projects</h1>
              <p className="text-slate-400 text-sm sm:text-base">
                {userPlan?.projectCount || 0}/{userPlan?.maxProjects === -1 ? '∞' : userPlan?.maxProjects} projects
                {userPlan?.plan === 'free' && (
                  <span className="text-slate-500 ml-2">• 1 scan per day</span>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              {userPlan?.plan === 'free' && (
                <Link
                  href="/pricing"
                  className="px-3 sm:px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg font-medium transition-all flex items-center gap-2 text-sm sm:text-base"
                >
                  <Zap className="h-4 w-4" />
                  <span className="hidden sm:inline">Upgrade to Pro</span>
                  <span className="sm:hidden">Upgrade</span>
                </Link>
              )}
              <button
                onClick={handleAddProjectClick}
                className="px-3 sm:px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm sm:text-base"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Project</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sort and View Controls */}
        {projects.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="latest">Latest Scan</option>
                <option value="score">Score</option>
                <option value="name">Name</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400 hidden sm:inline">View:</span>
              <div className="flex bg-slate-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                  title="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Real-time Scan Progress */}
        <ScanProgressIndicator
          watchAll
          onJobComplete={handleJobComplete}
          onJobFailed={handleJobFailed}
        />

        {/* Rate Limit Warning */}
        {userPlan?.plan === 'free' && !userPlan?.canScan && userPlan?.nextScanTime && (
          <div className="mb-6 p-4 bg-amber-900/20 border border-amber-600/30 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-amber-200 text-sm font-medium">Free Tier Rate Limit</p>
                <p className="text-amber-200/70 text-xs">
                  Next scan: {new Date(userPlan.nextScanTime).toLocaleString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setUpgradeReason('scan_limit')
                setShowUpgradeModal(true)
              }}
              className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1 whitespace-nowrap"
            >
              Get unlimited scans <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Projects */}
        {projects.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl p-8 sm:p-12 border border-slate-700 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-700/50 rounded-full mb-4">
              <Rocket className="h-8 w-8 text-slate-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold mb-2">No Projects Yet</h2>
            <p className="text-slate-400 mb-6 max-w-md mx-auto text-sm sm:text-base">
              Get started by adding your first project. We&apos;ll scan it and give you a comprehensive readiness score.
            </p>
            <button
              onClick={handleAddProjectClick}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors inline-flex items-center gap-2 animate-pulse-glow"
            >
              <Plus className="h-5 w-5" />
              Add Your First Project
            </button>
          </div>
        ) : (
          <>
            {/* Grid View */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {sortedProjects.map((project) => {
                  const latestScan = project.scans[0]
                  const scoreInfo = latestScan ? getScoreColor(latestScan.score) : null
                  const isScanning = scanning === project.id
                  
                  // Score-based status indicators (8 phases total)
                  const getPhaseStats = (score: number) => {
                    if (score >= 90) return { passed: 8, warnings: 0, failed: 0 }
                    if (score >= 80) return { passed: 7, warnings: 1, failed: 0 }
                    if (score >= 70) return { passed: 5, warnings: 2, failed: 1 }
                    if (score >= 60) return { passed: 4, warnings: 2, failed: 2 }
                    return { passed: 2, warnings: 3, failed: 3 }
                  }
                  const phaseStats = latestScan ? getPhaseStats(latestScan.score) : { passed: 0, warnings: 0, failed: 0 }
                  const { passed, warnings, failed } = phaseStats

                  return (
                    <div
                      key={project.id}
                      className={`bg-slate-800/50 rounded-xl p-5 sm:p-6 border border-slate-700 hover:border-slate-600 transition-all ${
                        isScanning ? 'animate-pulse' : ''
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {scoreInfo && <span className="text-lg">{scoreInfo.dot}</span>}
                            <Link
                              href={`/projects/${project.id}`}
                              className="text-lg font-semibold hover:text-indigo-400 transition-colors truncate"
                            >
                              {project.name}
                            </Link>
                          </div>
                          <a
                            href={project.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 text-sm hover:text-indigo-400 transition-colors flex items-center gap-1"
                          >
                            <span className="truncate">{new URL(project.url).hostname}</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        </div>
                        {latestScan && (
                          <div className="text-right ml-3">
                            <div className={`text-3xl font-bold ${scoreInfo?.text}`}>
                              {latestScan.score}
                            </div>
                            <div className="text-xs text-slate-500">/100</div>
                          </div>
                        )}
                      </div>

                      {/* Score Bar */}
                      {latestScan ? (
                        <div className="mb-4">
                          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${scoreInfo?.bg}`}
                              style={{ width: `${latestScan.score}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mb-4 p-3 bg-slate-700/30 rounded-lg">
                          <p className="text-sm text-slate-400">No scans yet</p>
                        </div>
                      )}

                      {/* Phase Summary */}
                      {latestScan && (
                        <div className="flex items-center gap-3 text-xs mb-3">
                          {passed > 0 && (
                            <span className="flex items-center gap-1 text-emerald-400">
                              <CheckCircle className="h-3 w-3" />
                              {passed} passed
                            </span>
                          )}
                          {warnings > 0 && (
                            <span className="flex items-center gap-1 text-amber-400">
                              <AlertTriangle className="h-3 w-3" />
                              {warnings} warnings
                            </span>
                          )}
                          {failed > 0 && (
                            <span className="flex items-center gap-1 text-red-400">
                              <X className="h-3 w-3" />
                              {failed} failed
                            </span>
                          )}
                        </div>
                      )}

                      {/* Meta Info */}
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                        <span>
                          Last scan: {latestScan ? formatRelativeTime(latestScan.scannedAt) : 'Never'}
                        </span>
                        {project.autoScanEnabled && (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Auto-scan ✓
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Link
                          href={`/projects/${project.id}`}
                          className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors text-center"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => handleScanProject(project.id)}
                          disabled={isScanning}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors"
                          title="Rescan"
                        >
                          <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          className="px-3 py-2 bg-slate-700 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-800/80 border-b border-slate-700">
                    <tr className="text-left text-sm text-slate-400">
                      <th className="px-4 py-3 font-medium">Project</th>
                      <th className="px-4 py-3 font-medium text-center hidden sm:table-cell">Score</th>
                      <th className="px-4 py-3 font-medium hidden md:table-cell">Status</th>
                      <th className="px-4 py-3 font-medium hidden lg:table-cell">Last Scan</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {sortedProjects.map((project) => {
                      const latestScan = project.scans[0]
                      const scoreInfo = latestScan ? getScoreColor(latestScan.score) : null
                      const isScanning = scanning === project.id

                      return (
                        <tr key={project.id} className="hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              {scoreInfo && <span>{scoreInfo.dot}</span>}
                              <div>
                                <Link
                                  href={`/projects/${project.id}`}
                                  className="font-medium hover:text-indigo-400 transition-colors"
                                >
                                  {project.name}
                                </Link>
                                <p className="text-xs text-slate-500">{new URL(project.url).hostname}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center hidden sm:table-cell">
                            {latestScan ? (
                              <span className={`text-xl font-bold ${scoreInfo?.text}`}>
                                {latestScan.score}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 hidden md:table-cell">
                            {latestScan ? (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-emerald-400">✓ {latestScan.score >= 80 ? 5 : 3}</span>
                                <span className="text-amber-400">⚠ {Math.floor((100 - latestScan.score) / 15)}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-sm">Not scanned</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-400 hidden lg:table-cell">
                            {latestScan ? formatRelativeTime(latestScan.scannedAt) : 'Never'}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/projects/${project.id}`}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
                              >
                                View
                              </Link>
                              <button
                                onClick={() => handleScanProject(project.id)}
                                disabled={isScanning}
                                className="p-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 rounded transition-colors"
                              >
                                <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Portfolio Overview (for Pro+ users with multiple projects) */}
            {projects.length > 1 && userPlan?.plan !== 'free' && (
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Score Distribution */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                  <h3 className="text-lg font-semibold mb-4">Portfolio Overview</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Average Score</span>
                      <span className={`text-xl font-bold ${getScoreColor(portfolioStats.avgScore).text}`}>
                        {portfolioStats.avgScore}/100
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-24 text-slate-500">90-100</span>
                        <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${(portfolioStats.distribution.excellent / portfolioStats.total) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-slate-400 text-right">{portfolioStats.distribution.excellent}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-24 text-slate-500">80-89</span>
                        <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-emerald-400"
                            style={{ width: `${(portfolioStats.distribution.good / portfolioStats.total) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-slate-400 text-right">{portfolioStats.distribution.good}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-24 text-slate-500">70-79</span>
                        <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-amber-500"
                            style={{ width: `${(portfolioStats.distribution.fair / portfolioStats.total) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-slate-400 text-right">{portfolioStats.distribution.fair}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-24 text-slate-500">60-69</span>
                        <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-amber-400"
                            style={{ width: `${(portfolioStats.distribution.poor / portfolioStats.total) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-slate-400 text-right">{portfolioStats.distribution.poor}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-24 text-slate-500">0-59</span>
                        <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-red-500"
                            style={{ width: `${(portfolioStats.distribution.critical / portfolioStats.total) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-slate-400 text-right">{portfolioStats.distribution.critical}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                  <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        sortedProjects.forEach((p) => handleScanProject(p.id))
                      }}
                      className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-3"
                    >
                      <RefreshCw className="h-5 w-5 text-indigo-400" />
                      Scan All Projects
                    </button>
                    <button
                      onClick={() => {
                        // Bulk PDF export - planned feature
                        addToast({ type: 'info', title: 'Coming soon!', message: 'Bulk PDF export is coming soon.' })
                      }}
                      className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-3"
                    >
                      <FileDown className="h-5 w-5 text-indigo-400" />
                      Export All Reports (PDF)
                    </button>
                    <Link
                      href="/settings"
                      className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-3"
                    >
                      <Settings className="h-5 w-5 text-indigo-400" />
                      Team Settings
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Upgrade Banner for Free Users */}
            {userPlan?.plan === 'free' && (
              <div className="mt-8 p-6 bg-gradient-to-r from-indigo-900/30 to-purple-900/30 rounded-xl border border-indigo-500/30">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-400" />
                      Want to track more projects?
                    </h3>
                    <p className="text-slate-300 text-sm">
                      Pro tier: 6 projects + unlimited scans + auto-scheduling
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Link
                      href="/pricing"
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition-colors flex items-center gap-2"
                    >
                      Upgrade to Pro - $19/mo
                    </Link>
                    <Link
                      href="/pricing"
                      className="px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                    >
                      Compare Plans
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Add Project Modal (Enhanced) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-800 rounded-xl p-6 max-w-lg w-full border border-slate-700 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Add New Project</h2>
                <p className="text-slate-400 text-sm mt-1">
                  {userPlan?.projectCount || 0}/{userPlan?.maxProjects === -1 ? '∞' : userPlan?.maxProjects} projects used
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewProject({ name: '', url: '', githubRepo: '', autoScan: false })
                  setFormErrors({})
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleAddProject}>
              {/* Project Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Project Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => {
                    setNewProject({ ...newProject, name: e.target.value })
                    if (formErrors.name) setFormErrors({ ...formErrors, name: undefined })
                  }}
                  onBlur={() => {
                    const result = validateField(newProject.name, 'name')
                    if (!result.valid) setFormErrors({ ...formErrors, name: result.error })
                  }}
                  className={`w-full px-4 py-3 bg-slate-700 border rounded-lg focus:outline-none focus:ring-1 transition-colors ${
                    formErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-600 focus:border-indigo-500 focus:ring-indigo-500'
                  }`}
                  placeholder="My New SaaS Product"
                  autoFocus
                />
                {formErrors.name && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* Website URL */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Primary URL (domain or website) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newProject.url}
                  onChange={(e) => {
                    setNewProject({ ...newProject, url: e.target.value })
                    if (formErrors.url) setFormErrors({ ...formErrors, url: undefined })
                  }}
                  onBlur={() => {
                    const result = validateField(newProject.url, 'url')
                    if (!result.valid) setFormErrors({ ...formErrors, url: result.error })
                  }}
                  className={`w-full px-4 py-3 bg-slate-700 border rounded-lg focus:outline-none focus:ring-1 transition-colors ${
                    formErrors.url ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-600 focus:border-indigo-500 focus:ring-indigo-500'
                  }`}
                  placeholder="https://mynewsaas.com"
                />
                {formErrors.url ? (
                  <p className="text-xs text-red-400 mt-1">{formErrors.url}</p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">
                    💡 We&apos;ll automatically scan this URL for all 8 phases
                  </p>
                )}
              </div>

              {/* Optional: GitHub (Pro feature) */}
              {userPlan?.plan !== 'free' && (
                <>
                  <div className="border-t border-slate-700 pt-6 mb-6">
                    <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                      <Github className="h-4 w-4" />
                      Optional: Connect GitHub for Deeper Analysis
                    </h3>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2 text-slate-400">
                        GitHub Repository
                      </label>
                      
                      {/* Show dropdown if GitHub is connected */}
                      {integrations?.githubConnected ? (
                        <div className="space-y-3">
                          <div className="relative">
                            <select
                              value={newProject.githubRepo}
                              onChange={(e) => setNewProject({ ...newProject, githubRepo: e.target.value })}
                              onFocus={fetchUserRepos}
                              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                            >
                              <option value="">-- Select a repository --</option>
                              {loadingRepos && <option disabled>Loading repos...</option>}
                              {userRepos.map((repo) => (
                                <option key={repo.fullName} value={repo.fullName}>
                                  {repo.fullName} {repo.private ? '(private)' : ''} {repo.language ? `• ${repo.language}` : ''}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                          </div>
                          <p className="text-xs text-slate-500">
                            Connected as @{integrations.githubUsername}
                          </p>
                          <div className="text-xs text-slate-500">
                            <input
                              type="text"
                              value={newProject.githubRepo}
                              onChange={(e) => setNewProject({ ...newProject, githubRepo: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                              placeholder="Or enter manually: owner/repo"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={newProject.githubRepo}
                            onChange={(e) => setNewProject({ ...newProject, githubRepo: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                            placeholder="owner/repo"
                          />
                          <div className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg border border-slate-600/50">
                            <Github className="h-4 w-4 text-slate-400" />
                            <span className="text-xs text-slate-400">
                              <a href="/settings" className="text-indigo-400 hover:text-indigo-300 underline">
                                Connect GitHub
                              </a>
                              {' '}to browse your repositories
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-3 text-xs text-slate-500 space-y-1">
                        <p>Unlocks:</p>
                        <ul className="list-disc list-inside ml-2 space-y-0.5">
                          <li>✅ Secret scanning (detect leaked API keys)</li>
                          <li>✅ Debug statement detection (console.log)</li>
                          <li>✅ ENV variable checks</li>
                          <li>✅ Dependency vulnerability scanning</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Auto-Scan Settings */}
                  <div className="border-t border-slate-700 pt-6 mb-6">
                    <h3 className="text-sm font-medium text-slate-300 mb-4">
                      Auto-Scan Settings (Pro Feature)
                    </h3>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newProject.autoScan}
                        onChange={(e) => setNewProject({ ...newProject, autoScan: e.target.checked })}
                        className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm">Enable daily auto-scans</span>
                    </label>
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setNewProject({ name: '', url: '', githubRepo: '', autoScan: false })
                  }}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingProject}
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {addingProject ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Add Project & Scan Now
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentPlan={userPlan?.plan || 'free'}
        currentProjectCount={userPlan?.projectCount || 0}
        maxProjects={userPlan?.maxProjects || 1}
        reason={upgradeReason}
      />

      {/* Scan Progress Modal */}
      <ScanProgressModal
        isOpen={!!scanModalProject}
        onClose={() => setScanModalProject(null)}
        projectId={scanModalProject?.id || ''}
        projectUrl={scanModalProject?.url}
        onComplete={fetchProjects}
      />
    </div>
  )
}
