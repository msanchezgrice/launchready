'use client'

import { useEffect, useState, useCallback } from 'react'
import { UserButton } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
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
} from 'lucide-react'
import UpgradeModal from '@/components/ui/UpgradeModal'
import { ProjectCardSkeleton } from '@/components/ui/Skeleton'
import ScanProgressIndicator from '@/components/ui/ScanProgressIndicator'

interface Project {
  id: string
  name: string
  url: string
  createdAt: string
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
  const [newProject, setNewProject] = useState({ name: '', url: '' })
  const [addingProject, setAddingProject] = useState(false)
  const [scanning, setScanning] = useState<string | null>(null)
  const [manageLoading, setManageLoading] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const searchParams = useSearchParams()

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

  function handleAddProjectClick() {
    // Check if user has reached project limit
    if (userPlan && userPlan.projectCount >= userPlan.maxProjects && userPlan.maxProjects !== -1) {
      setUpgradeReason('project_limit')
      setShowUpgradeModal(true)
    } else {
      setShowAddModal(true)
    }
  }

  async function handleAddProject(e: React.FormEvent) {
    e.preventDefault()
    setAddingProject(true)

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
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

      setNewProject({ name: '', url: '' })
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

  async function handleScanProject(projectId: string) {
    // Check rate limit for free tier
    if (userPlan?.plan === 'free' && !userPlan?.canScan) {
      setUpgradeReason('scan_limit')
      setShowUpgradeModal(true)
      return
    }

    setScanning(projectId)

    try {
      const res = await fetch(`/api/projects/${projectId}/scan`, {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.upgrade) {
          setUpgradeReason('scan_limit')
          setShowUpgradeModal(true)
        } else {
          addToast({
            type: 'error',
            title: 'Scan failed',
            message: data.error || data.message || 'Please try again.',
          })
        }
        return
      }

      addToast({
        type: 'success',
        title: 'Scan complete!',
        message: `Score: ${data.scan?.score || 'N/A'}/100`,
      })
      fetchProjects()
    } catch {
      addToast({
        type: 'error',
        title: 'Scan failed',
        message: 'Please check your connection and try again.',
      })
    } finally {
      setScanning(null)
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
    // Refresh projects to show new scan
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

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900">
        {/* Header skeleton */}
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

        {/* Upgrade Banner for Free Users */}
        {userPlan?.plan === 'free' && projects.length > 0 && (
          <div className="mb-8 p-4 sm:p-6 bg-gradient-to-r from-indigo-900/30 to-purple-900/30 rounded-xl border border-indigo-500/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  🚀 Unlock More with Pro
                </h3>
                <p className="text-slate-300 text-sm">
                  Get 6 projects, unlimited scans, and auto-scheduling
                </p>
              </div>
              <Link
                href="/pricing"
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap text-sm sm:text-base"
              >
                Upgrade - $19/mo
                <ArrowRight className="h-4 w-4" />
              </Link>
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
              <p className="text-amber-200 text-sm">
                Next scan: {new Date(userPlan.nextScanTime).toLocaleString()}
              </p>
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

        {/* Projects Grid */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {projects.map((project) => {
              const latestScan = project.scans[0]
              const scoreColor =
                !latestScan
                  ? 'text-slate-400'
                  : latestScan.score >= 80
                  ? 'text-emerald-400'
                  : latestScan.score >= 60
                  ? 'text-amber-400'
                  : 'text-red-400'
              const isScanning = scanning === project.id

              return (
                <div
                  key={project.id}
                  className={`bg-slate-800/50 rounded-xl p-5 sm:p-6 border border-slate-700 hover:border-slate-600 transition-all ${
                    isScanning ? 'animate-pulse' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-lg font-semibold mb-1 hover:text-indigo-400 transition-colors block truncate"
                      >
                        {project.name}
                      </Link>
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
                        <div className={`text-3xl font-bold ${scoreColor}`}>
                          {latestScan.score}
                        </div>
                        <div className="text-xs text-slate-500">/100</div>
                      </div>
                    )}
                  </div>

                  {latestScan ? (
                    <div className="mb-4">
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            latestScan.score >= 80
                              ? 'bg-emerald-500'
                              : latestScan.score >= 60
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${latestScan.score}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Scanned {new Date(latestScan.scannedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ) : (
                    <div className="mb-4 p-3 bg-slate-700/30 rounded-lg">
                      <p className="text-sm text-slate-400">No scans yet</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Link
                      href={`/projects/${project.id}`}
                      className="flex-1 px-3 sm:px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="hidden sm:inline">View Details</span>
                      <span className="sm:hidden">Details</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleScanProject(project.id)}
                      disabled={isScanning}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
                      title="Rescan project"
                    >
                      <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleDeleteProject(project.id)}
                      className="px-3 py-2 bg-slate-700 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors"
                      title="Delete project"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700 shadow-2xl animate-scale-in">
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
                  setNewProject({ name: '', url: '' })
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleAddProject}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Project Name</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  placeholder="My Awesome Project"
                  required
                  autoFocus
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Website URL</label>
                <input
                  type="url"
                  value={newProject.url}
                  onChange={(e) => setNewProject({ ...newProject, url: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  placeholder="https://example.com"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setNewProject({ name: '', url: '' })
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
                      Add & Scan
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
    </div>
  )
}
