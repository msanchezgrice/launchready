// Server component - no 'use client'
import Link from 'next/link'
import { ArrowLeft, Rocket } from 'lucide-react'
import ScanClient from './ScanClient'

export default async function ScanProgressPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              href={`/projects/${projectId}`}
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
        <ScanClient projectId={projectId} />
      </main>
    </div>
  )
}
// Deployment marker: 1767656539
