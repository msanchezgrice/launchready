'use client'

import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react'

interface ScanHistory {
  id: string
  score: number
  scannedAt: string
}

interface ScoreHistoryChartProps {
  projectId: string
  className?: string
  showTrend?: boolean
}

export default function ScoreHistoryChart({
  projectId,
  className = '',
  showTrend = true,
}: ScoreHistoryChartProps) {
  const [history, setHistory] = useState<ScanHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch(`/api/projects/${projectId}/history`)
        if (!res.ok) throw new Error('Failed to fetch history')
        const data = await res.json()
        setHistory(data.scans || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history')
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [projectId])

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-48 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (error || history.length === 0) {
    return (
      <div className={`flex items-center justify-center h-48 text-slate-500 text-sm ${className}`}>
        {error || 'No scan history yet'}
      </div>
    )
  }

  // Calculate trend
  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime()
  )
  
  const chartData = sortedHistory.map((scan) => ({
    date: new Date(scan.scannedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    fullDate: new Date(scan.scannedAt).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    score: scan.score,
  }))

  // Calculate average and trend
  const avgScore = Math.round(
    sortedHistory.reduce((sum, s) => sum + s.score, 0) / sortedHistory.length
  )
  
  let trend: 'up' | 'down' | 'stable' = 'stable'
  let trendValue = 0
  if (sortedHistory.length >= 2) {
    const recent = sortedHistory.slice(-3)
    const older = sortedHistory.slice(0, Math.max(1, sortedHistory.length - 3))
    const recentAvg = recent.reduce((sum, s) => sum + s.score, 0) / recent.length
    const olderAvg = older.reduce((sum, s) => sum + s.score, 0) / older.length
    trendValue = Math.round(recentAvg - olderAvg)
    if (trendValue > 2) trend = 'up'
    else if (trendValue < -2) trend = 'down'
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-xs text-slate-400 mb-1">{data.fullDate}</p>
          <p className="text-lg font-bold text-white">
            Score: <span className={getScoreColor(data.score)}>{data.score}</span>
          </p>
        </div>
      )
    }
    return null
  }

  function getScoreColor(score: number) {
    if (score >= 80) return 'text-emerald-400'
    if (score >= 60) return 'text-amber-400'
    return 'text-red-400'
  }

  return (
    <div className={className}>
      {/* Header with trend */}
      {showTrend && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-medium text-slate-400">Score History</h4>
            <p className="text-xs text-slate-500">
              {sortedHistory.length} scan{sortedHistory.length !== 1 ? 's' : ''} • Avg: {avgScore}
            </p>
          </div>
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              trend === 'up'
                ? 'bg-emerald-900/30 text-emerald-400'
                : trend === 'down'
                ? 'bg-red-900/30 text-red-400'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {trend === 'up' && <TrendingUp className="h-3 w-3" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3" />}
            {trend === 'stable' && <Minus className="h-3 w-3" />}
            <span>
              {trend === 'up' && `+${trendValue}`}
              {trend === 'down' && trendValue}
              {trend === 'stable' && 'Stable'}
            </span>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              ticks={[0, 25, 50, 75, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            {/* Reference lines for score thresholds */}
            <ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.3} />
            <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.3} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{
                fill: '#6366f1',
                strokeWidth: 2,
                r: 4,
                stroke: '#1e1b4b',
              }}
              activeDot={{
                fill: '#6366f1',
                strokeWidth: 3,
                r: 6,
                stroke: '#c7d2fe',
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-emerald-500" /> 80+ (Launch Ready)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-amber-500" /> 60+ (Needs Work)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-red-500" /> Below 60 (Not Ready)
        </span>
      </div>
    </div>
  )
}
