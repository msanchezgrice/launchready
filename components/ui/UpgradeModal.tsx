'use client'

import { useState } from 'react'
import { X, Check, Rocket, Zap, Crown, ArrowRight, Sparkles } from 'lucide-react'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  currentPlan: string
  currentProjectCount: number
  maxProjects: number
  reason?: 'project_limit' | 'scan_limit' | 'feature'
}

const PLANS = [
  {
    name: 'Pro',
    price: 19,
    icon: Zap,
    color: 'indigo',
    features: [
      '6 projects',
      'Unlimited scans',
      '90-day history',
      'Auto-scheduled scans',
      'GitHub integration',
      'PDF export',
    ],
    popular: true,
  },
  {
    name: 'Pro Plus',
    price: 39,
    icon: Crown,
    color: 'purple',
    features: [
      '15 projects',
      'Unlimited scans',
      '1-year history',
      'Auto-scheduled scans',
      'GitHub integration',
      'PDF export',
      'White-label reports',
      '3 team members',
      'Priority support',
    ],
    popular: false,
  },
]

export default function UpgradeModal({
  isOpen,
  onClose,
  currentPlan,
  currentProjectCount,
  maxProjects,
  reason = 'project_limit',
}: UpgradeModalProps) {
  const [loading, setLoading] = useState<string | null>(null)

  if (!isOpen) return null

  const handleUpgrade = async (planName: string) => {
    setLoading(planName)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planName.toLowerCase().replace(' ', '_') }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Checkout error:', error)
    } finally {
      setLoading(null)
    }
  }

  const titles = {
    project_limit: 'Project Limit Reached',
    scan_limit: 'Scan Limit Reached',
    feature: 'Unlock Premium Features',
  }

  const subtitles = {
    project_limit: `You've used all ${maxProjects} project${maxProjects === 1 ? '' : 's'} on the ${currentPlan} plan.`,
    scan_limit: 'Free tier allows 1 scan per day. Upgrade for unlimited scans.',
    feature: 'Get access to advanced features with a Pro subscription.',
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 rounded-2xl max-w-3xl w-full border border-slate-700 shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          <Sparkles className="h-12 w-12 mx-auto mb-3 text-white/90" />
          <h2 className="text-2xl font-bold text-white mb-2">{titles[reason]}</h2>
          <p className="text-white/80">{subtitles[reason]}</p>
        </div>

        {/* Current Status */}
        <div className="bg-slate-800/50 px-6 py-3 flex items-center justify-center gap-2 border-b border-slate-700">
          <Rocket className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-400">
            Current: <span className="text-white font-medium">{currentPlan}</span>
            {reason === 'project_limit' && (
              <span className="ml-2 text-slate-500">
                ({currentProjectCount}/{maxProjects} projects)
              </span>
            )}
          </span>
        </div>

        {/* Plans */}
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-4">
            {PLANS.map((plan) => {
              const Icon = plan.icon
              const isLoading = loading === plan.name
              const colorClasses = {
                indigo: {
                  bg: 'bg-indigo-600 hover:bg-indigo-700',
                  border: 'border-indigo-500',
                  badge: 'bg-indigo-500',
                },
                purple: {
                  bg: 'bg-purple-600 hover:bg-purple-700',
                  border: 'border-purple-500',
                  badge: 'bg-purple-500',
                },
              }
              const colors = colorClasses[plan.color as keyof typeof colorClasses]

              return (
                <div
                  key={plan.name}
                  className={`relative rounded-xl border ${
                    plan.popular ? colors.border : 'border-slate-700'
                  } bg-slate-800/50 p-5 transition-all hover:border-slate-500`}
                >
                  {plan.popular && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 ${colors.badge} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                      MOST POPULAR
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 ${colors.bg} rounded-lg`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">{plan.name}</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-white">${plan.price}</span>
                        <span className="text-slate-400 text-sm">/month</span>
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-2 mb-5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        <span className="text-slate-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleUpgrade(plan.name)}
                    disabled={isLoading}
                    className={`w-full py-3 ${colors.bg} text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50`}
                  >
                    {isLoading ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Upgrade to {plan.name}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>

          <p className="text-center text-slate-500 text-sm mt-4">
            Cancel anytime. 14-day money-back guarantee.
          </p>
        </div>
      </div>
    </div>
  )
}
