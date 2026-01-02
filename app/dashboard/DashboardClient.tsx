'use client'

import { useEffect, useState } from 'react'
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
  Eye,
} from 'lucide-react'

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
  const [newProject, setNewProject] = useState({ name: '', url: '' })
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [scanning, setScanning] = useState<string | null>(null)
  const [manageLoading, setManageLoading] = useState(false)
  const searchParams = useSearchParams()

  // Check for checkout success
  useEffect(() => {
    const checkout = searchParams.get('checkout')
    const plan = searchParams.get('plan')
    if (checkout === 'success' && plan) {
      setSuccessMessage(`🎉 Welcome to ${plan.charAt(0).toUpperCase() + plan.slice(1)}! Your subscription is now active.`)
      // Clear URL params
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [searchParams])

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
    } finally {
      setLoading(false)
    }
  }

  async function handleAddProject(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.upgrade) {
          setError(`Project limit reached (${userPlan?.projectCount}/${userPlan?.maxProjects}). Upgrade for more projects!`)
        } else {
          setError(data.error || 'Failed to create project')
        }
        return
      }

      setNewProject({ name: '', url: '' })
      setShowAddModal(false)
      fetchProjects()
    } catch {
      setError('Failed to create project')
    }
  }

  async function handleScanProject(projectId: string) {
    setScanning(projectId)
    setError('')

    try {
      const res = await fetch(`/api/projects/${projectId}/scan`, {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.upgrade) {
          setError(data.message || 'Rate limit exceeded. Upgrade for unlimited scans!')
        } else {
          setError(data.error || 'Failed to scan project')
        }
        return
      }

      fetchProjects()
    } catch {
      setError('Failed to scan project')
    } finally {
      setScanning(null)
    }
  }

  async function handleDeleteProject(projectId: string) {
    if (!confirm('Are you sure you want to delete this project?')) return

    try {
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      fetchProjects()
    } catch {
      setError('Failed to delete project')
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
        setError('Unable to open subscription management')
      }
    } catch {
      setError('Failed to open subscription management')
    } finally {
      setManageLoading(false)
    }
  }

  const planBadge = userPlan ? PLAN_BADGES[userPlan.plan] || PLAN_BADGES.free : PLAN_BADGES.free
  const PlanIcon = planBadge.icon

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <Rocket className="h-8 w-8 text-indigo-500" />
                <span className="text-xl font-bold">LaunchReady.me</span>
              </Link>
              <span className={`px-2 py-1 ${planBadge.color} rounded-full text-xs font-medium flex items-center gap-1`}>
                <PlanIcon className="h-3 w-3" />
                {planBadge.label}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/pricing"
                className="text-slate-300 hover:text-white transition-colors text-sm"
              >
                Pricing
              </Link>
              {userPlan?.stripeCustomerId && (
                <button
                  onClick={handleManageSubscription}
                  disabled={manageLoading}
                  className="text-slate-300 hover:text-white transition-colors text-sm flex items-center gap-1"
                >
                  <Settings className="h-4 w-4" />
                  {manageLoading ? 'Loading...' : 'Manage'}
                </button>
              )}
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-900/20 border border-green-600/30 rounded-lg">
            <p className="text-green-200">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-600/30 rounded-lg flex justify-between items-start">
            <p className="text-red-200 text-sm">{error}</p>
            {error.includes('Upgrade') && (
              <Link
                href="/pricing"
                className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1 whitespace-nowrap ml-4"
              >
                Upgrade <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}

        {/* Dashboard Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">My Projects</h1>
              <p className="text-slate-400">
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
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg font-medium transition-all flex items-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Upgrade to Pro
                </Link>
              )}
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Project
              </button>
            </div>
          </div>
        </div>

        {/* Upgrade Banner for Free Users */}
        {userPlan?.plan === 'free' && projects.length > 0 && (
          <div className="mb-8 p-6 bg-gradient-to-r from-indigo-900/30 to-purple-900/30 rounded-xl border border-indigo-500/30">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  🚀 Unlock More with Pro
                </h3>
                <p className="text-slate-300 text-sm">
                  Get 6 projects, unlimited scans, auto-scheduling, and GitHub integration
                </p>
              </div>
              <Link
                href="/pricing"
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                Upgrade to Pro - $19/mo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Rate Limit Warning */}
        {userPlan?.plan === 'free' && !userPlan?.canScan && userPlan?.nextScanTime && (
          <div className="mb-6 p-4 bg-amber-900/20 border border-amber-600/30 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-400" />
              <p className="text-amber-200 text-sm">
                Next scan available: {new Date(userPlan.nextScanTime).toLocaleString()}
              </p>
            </div>
            <Link
              href="/pricing"
              className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1"
            >
              Get unlimited scans <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
            <Rocket className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Projects Yet</h2>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Get started by adding your first project. We&apos;ll scan it and give you a comprehensive readiness score.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Add Your First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const latestScan = project.scans[0]
              const scoreColor =
                !latestScan
                  ? 'text-slate-400'
                  : latestScan.score >= 80
                  ? 'text-green-400'
                  : latestScan.score >= 60
                  ? 'text-amber-400'
                  : 'text-red-400'

              return (
                <div
                  key={project.id}
                  className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-lg font-semibold mb-1 hover:text-indigo-400 transition-colors block"
                      >
                        {project.name}
                      </Link>
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 text-sm hover:text-indigo-400 transition-colors flex items-center gap-1"
                      >
                        {new URL(project.url).hostname}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    {latestScan && (
                      <div className="text-right">
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
                          className={`h-full rounded-full ${
                            latestScan.score >= 80
                              ? 'bg-green-500'
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
                      className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      View Details
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleScanProject(project.id)}
                      disabled={scanning === project.id || (userPlan?.plan === 'free' && !userPlan?.canScan)}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
                      title="Rescan project"
                    >
                      {scanning === project.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-2">Add New Project</h2>
            <p className="text-slate-400 text-sm mb-6">
              {userPlan?.projectCount || 0}/{userPlan?.maxProjects === -1 ? '∞' : userPlan?.maxProjects} projects used
            </p>
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
                    setError('')
                  }}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors"
                >
                  Add & Scan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
