'use client'

import { useEffect, useState } from 'react'
import { UserButton } from '@clerk/nextjs'

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

export default function DashboardClient() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', url: '' })
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      setProjects(data.projects || [])
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
          setError('Free tier limited to 1 project. Upgrade to add more!')
        } else {
          setError(data.error || 'Failed to create project')
        }
        return
      }

      setNewProject({ name: '', url: '' })
      setShowAddModal(false)
      fetchProjects()
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      setError('Failed to delete project')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
            <p className="text-gray-400">Manage your projects and scans</p>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-600/30 rounded-lg">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="bg-slate-800/50 rounded-lg p-8 border border-slate-700">
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold mb-4">No Projects Yet</h2>
              <p className="text-gray-400 mb-6">
                Get started by adding your first project to scan
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Add Project
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 flex justify-end">
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                + Add Project
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-slate-800/50 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <h3 className="text-xl font-semibold mb-2">{project.name}</h3>
                  <p className="text-gray-400 text-sm mb-4 truncate">{project.url}</p>

                  {project.scans[0] ? (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Latest Score</span>
                        <span className="text-2xl font-bold text-blue-400">
                          {project.scans[0].score}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Scanned {new Date(project.scans[0].scannedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ) : (
                    <div className="mb-4 text-sm text-gray-500">No scans yet</div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleScanProject(project.id)}
                      disabled={scanning === project.id}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                    >
                      {scanning === project.id ? 'Scanning...' : 'Scan Now'}
                    </button>
                    <button
                      onClick={() => handleDeleteProject(project.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
              <h2 className="text-2xl font-bold mb-4">Add New Project</h2>
              <form onSubmit={handleAddProject}>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Project Name</label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
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
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
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
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                  >
                    Add Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
