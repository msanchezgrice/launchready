'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Github,
  Triangle,
  Check,
  X,
  Bell,
  Mail,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Webhook,
  Lock,
} from 'lucide-react'

interface UserSettings {
  id: string
  email: string
  name: string | null
  plan: string
  // Notifications
  scoreDropAlerts: boolean
  weeklyDigest: boolean
  scanCompleteNotify: boolean
  webhookUrl: string | null
  // GitHub
  githubConnected: boolean
  githubUsername: string | null
  githubConnectedAt: string | null
  // Vercel
  vercelConnected: boolean
  vercelUsername: string | null
  vercelTeamId: string | null
  vercelConnectedAt: string | null
}

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingWebhook, setSavingWebhook] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')

  // Check for OAuth success/error messages
  useEffect(() => {
    const github = searchParams.get('github')
    const vercel = searchParams.get('vercel')
    const errorParam = searchParams.get('error')

    if (github === 'connected') {
      setSuccessMessage('GitHub connected successfully!')
      // Clean URL
      window.history.replaceState({}, '', '/settings')
    } else if (vercel === 'connected') {
      setSuccessMessage('Vercel connected successfully!')
      window.history.replaceState({}, '', '/settings')
    } else if (errorParam) {
      setError(`Connection failed: ${errorParam.replace(/_/g, ' ')}`)
      window.history.replaceState({}, '', '/settings')
    }
  }, [searchParams])

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => {
        setSuccessMessage('')
        setError('')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage, error])

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/user/settings')
      if (!res.ok) throw new Error('Failed to fetch settings')
      const data = await res.json()
      setSettings(data.user)
      setWebhookUrl(data.user?.webhookUrl || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  async function saveWebhookUrl() {
    if (!settings) return
    setSavingWebhook(true)
    setError('')
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: webhookUrl || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save webhook URL')
      }
      setSettings({ ...settings, webhookUrl: webhookUrl || null })
      setSuccessMessage('Webhook URL saved successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save webhook URL')
    } finally {
      setSavingWebhook(false)
    }
  }

  async function updateNotificationSetting(key: string, value: boolean) {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      if (!res.ok) throw new Error('Failed to update')
      setSettings({ ...settings, [key]: value })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function disconnectService(service: 'github' | 'vercel') {
    setDisconnecting(service)
    try {
      const res = await fetch(`/api/user/disconnect/${service}`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to disconnect')
      
      if (service === 'github') {
        setSettings(s => s ? { ...s, githubConnected: false, githubUsername: null, githubConnectedAt: null } : null)
      } else {
        setSettings(s => s ? { ...s, vercelConnected: false, vercelUsername: null, vercelConnectedAt: null } : null)
      }
      setSuccessMessage(`${service === 'github' ? 'GitHub' : 'Vercel'} disconnected`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setDisconnecting(null)
    }
  }

  function connectGitHub() {
    window.location.href = `/api/auth/github?returnTo=/settings`
  }

  function connectVercel() {
    window.location.href = `/api/auth/vercel?returnTo=/settings`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <h1 className="text-xl font-bold">Settings</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-4 flex items-center gap-3">
            <Check className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <p className="text-emerald-200">{successMessage}</p>
          </div>
        )}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Integrations Section */}
        <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-indigo-400" />
            Connected Accounts
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Connect your accounts once to enable deep scanning across all your projects.
          </p>

          <div className="space-y-4">
            {/* GitHub Integration */}
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-800 rounded-lg">
                    <Github className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-medium">GitHub</h3>
                    <p className="text-sm text-slate-400">
                      Scan repositories for secrets, debug code, and dependency issues
                    </p>
                  </div>
                </div>
                {settings?.githubConnected ? (
                  <span className="px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded-full text-xs flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Connected
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-slate-700 text-slate-400 rounded-full text-xs">
                    Not connected
                  </span>
                )}
              </div>

              {settings?.githubConnected ? (
                <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-slate-500">Account:</span>{' '}
                    <span className="text-white">@{settings.githubUsername}</span>
                    {settings.githubConnectedAt && (
                      <span className="text-slate-500 ml-3">
                        Connected {new Date(settings.githubConnectedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={connectGitHub}
                      className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    >
                      Reconnect
                    </button>
                    <button
                      onClick={() => disconnectService('github')}
                      disabled={disconnecting === 'github'}
                      className="px-3 py-1.5 text-sm bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors flex items-center gap-1"
                    >
                      {disconnecting === 'github' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <button
                    onClick={connectGitHub}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Github className="h-4 w-4" />
                    Connect GitHub
                  </button>
                </div>
              )}
            </div>

            {/* Vercel Integration - Coming Soon */}
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-5 opacity-60">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-800 rounded-lg">
                    <Triangle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-medium">Vercel</h3>
                    <p className="text-sm text-slate-400">
                      Check deployment status, environment variables, and domain configuration
                    </p>
                  </div>
                </div>
                <span className="px-2 py-1 bg-amber-900/30 text-amber-400 rounded-full text-xs">
                  Coming Soon
                </span>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-500">
                  Vercel integration is being finalized. GitHub scanning covers the most critical launch checks!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Notification Preferences */}
        <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-400" />
            Notification Preferences
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Choose how you want to be notified about your projects.
          </p>

          <div className="space-y-1">
            {/* Score Drop Alerts */}
            <div className="flex items-center justify-between p-4 rounded-lg hover:bg-slate-700/30 transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-amber-900/30 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Score Drop Alerts</p>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Get notified when your launch readiness score drops by more than 10 points
                  </p>
                </div>
              </div>
              <button
                onClick={() => updateNotificationSetting('scoreDropAlerts', !settings?.scoreDropAlerts)}
                disabled={saving}
                className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ${
                  settings?.scoreDropAlerts ? 'bg-indigo-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                    settings?.scoreDropAlerts ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Weekly Digest */}
            <div className="flex items-center justify-between p-4 rounded-lg hover:bg-slate-700/30 transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-blue-900/30 rounded-lg">
                  <Mail className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Weekly Digest</p>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Receive a weekly summary of all your projects&apos; readiness scores every Monday
                  </p>
                </div>
              </div>
              <button
                onClick={() => updateNotificationSetting('weeklyDigest', !settings?.weeklyDigest)}
                disabled={saving}
                className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ${
                  settings?.weeklyDigest ? 'bg-indigo-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                    settings?.weeklyDigest ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Scan Complete */}
            <div className="flex items-center justify-between p-4 rounded-lg hover:bg-slate-700/30 transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-emerald-900/30 rounded-lg">
                  <Check className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Scan Complete Notifications</p>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Get notified when auto-scans finish running
                  </p>
                </div>
              </div>
              <button
                onClick={() => updateNotificationSetting('scanCompleteNotify', !settings?.scanCompleteNotify)}
                disabled={saving}
                className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ${
                  settings?.scanCompleteNotify ? 'bg-indigo-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                    settings?.scanCompleteNotify ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Webhooks Section */}
        <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Webhook className="h-5 w-5 text-indigo-400" />
            Webhooks
            {(settings?.plan !== 'pro_plus' && settings?.plan !== 'enterprise') && (
              <span className="ml-2 px-2 py-0.5 bg-amber-900/30 text-amber-400 rounded-full text-xs flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Pro Plus+
              </span>
            )}
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Send scan notifications to Slack, Discord, or any custom webhook URL.
          </p>

          {(settings?.plan === 'pro_plus' || settings?.plan === 'enterprise') ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Webhook URL
                </label>
                <div className="flex gap-3">
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="flex-1 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    onClick={saveWebhookUrl}
                    disabled={savingWebhook || webhookUrl === (settings?.webhookUrl || '')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {savingWebhook ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Supported: Slack webhooks, Discord webhooks, or any custom URL that accepts POST requests
                </p>
              </div>

              {settings?.webhookUrl && (
                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-2 text-slate-300">What you&apos;ll receive:</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Scan completion notifications with score and breakdown</li>
                    <li>• Score drop alerts when your readiness drops</li>
                    <li>• Rich formatting for Slack and Discord</li>
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6 text-center">
              <Lock className="h-8 w-8 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-300 font-medium mb-2">Webhooks require Pro Plus or Enterprise</p>
              <p className="text-sm text-slate-400 mb-4">
                Upgrade to get Slack/Discord notifications for your scans.
              </p>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
              >
                View Pricing
              </Link>
            </div>
          )}
        </section>

        {/* Account Info */}
        <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Account</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Email</span>
              <span>{settings?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Plan</span>
              <span className="capitalize">{settings?.plan}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
