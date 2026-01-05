import { Rocket, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ScanLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
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
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-indigo-400" />
          <p className="mt-4 text-slate-400 text-lg">Initializing scan...</p>
        </div>
      </main>
    </div>
  )
}
