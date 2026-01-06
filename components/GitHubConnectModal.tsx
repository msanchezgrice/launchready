'use client'

import { useState } from 'react'
import { Github, X, Globe, FolderGit, Loader2, ChevronRight, Lock, Shield } from 'lucide-react'

interface GitHubConnectModalProps {
  isOpen: boolean
  onClose: () => void
  returnTo?: string
}

export default function GitHubConnectModal({ isOpen, onClose, returnTo = '/settings' }: GitHubConnectModalProps) {
  const [selectedOption, setSelectedOption] = useState<'all' | 'select'>('all')
  const [isConnecting, setIsConnecting] = useState(false)

  if (!isOpen) return null

  function handleConnect() {
    setIsConnecting(true)
    // Pass the scope preference to the OAuth endpoint
    const scope = selectedOption === 'all' ? 'repo' : 'public_repo'
    window.location.href = `/api/auth/github?returnTo=${encodeURIComponent(returnTo)}&scope=${scope}&mode=${selectedOption}`
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-lg w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-700 rounded-lg">
              <Github className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Connect GitHub</h2>
              <p className="text-sm text-slate-400">Enable deep code scanning</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Options */}
        <div className="p-6 space-y-4">
          <p className="text-slate-300 text-sm">
            Choose how much access to grant LaunchReady:
          </p>

          {/* Option 1: All repositories */}
          <button
            onClick={() => setSelectedOption('all')}
            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
              selectedOption === 'all'
                ? 'border-indigo-500 bg-indigo-900/20'
                : 'border-slate-600 hover:border-slate-500 bg-slate-900/50'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg ${
                selectedOption === 'all' ? 'bg-indigo-600' : 'bg-slate-700'
              }`}>
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">All my repositories</span>
                  <span className="px-2 py-0.5 bg-emerald-900/50 text-emerald-400 rounded-full text-xs">
                    Recommended
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  We&apos;ll scan and monitor all your repos. Best for managing multiple projects.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded text-xs flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Secrets detection
                  </span>
                  <span className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded text-xs">
                    Debug code alerts
                  </span>
                  <span className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded text-xs">
                    Analytics detection
                  </span>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                selectedOption === 'all'
                  ? 'border-indigo-500 bg-indigo-500'
                  : 'border-slate-500'
              }`}>
                {selectedOption === 'all' && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
            </div>
          </button>

          {/* Option 2: Select specific */}
          <button
            onClick={() => setSelectedOption('select')}
            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
              selectedOption === 'select'
                ? 'border-indigo-500 bg-indigo-900/20'
                : 'border-slate-600 hover:border-slate-500 bg-slate-900/50'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg ${
                selectedOption === 'select' ? 'bg-indigo-600' : 'bg-slate-700'
              }`}>
                <FolderGit className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">Select specific repositories</span>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  Choose which projects to track. You can add more later.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded text-xs flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Minimal access
                  </span>
                  <span className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded text-xs">
                    Public repos only
                  </span>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                selectedOption === 'select'
                  ? 'border-indigo-500 bg-indigo-500'
                  : 'border-slate-500'
              }`}>
                {selectedOption === 'select' && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
            </div>
          </button>

          {/* Permission notice */}
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-slate-300 mb-2">🔒 What we access:</h4>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• Read-only access to repository contents</li>
              <li>• File scanning for secrets &amp; debug code</li>
              <li>• Package.json for dependency analysis</li>
              <li>• Environment file examples (.env.example)</li>
            </ul>
            <p className="text-xs text-slate-500 mt-2">
              We never modify your code or push changes.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-700 bg-slate-900/30 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="px-6 py-2.5 bg-white hover:bg-slate-100 text-slate-900 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Github className="h-4 w-4" />
                Connect with GitHub
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
