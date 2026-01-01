import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const user = await currentUser()

  if (!user) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-gray-400">Manage your projects and scans</p>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-8 border border-slate-700">
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4">No Projects Yet</h2>
            <p className="text-gray-400 mb-6">
              Get started by adding your first project to scan
            </p>
            <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">
              Add Project
            </button>
          </div>
        </div>

        <div className="mt-8 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
          <p className="text-yellow-200 text-sm">
            <strong>Note:</strong> Database setup required. Please configure DATABASE_URL in Vercel environment variables to enable project management.
          </p>
        </div>
      </div>
    </div>
  )
}
