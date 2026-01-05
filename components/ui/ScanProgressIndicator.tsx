'use client';

import { useScanProgress, ScanJob } from '@/lib/hooks/useScanProgress';
import { RefreshCw, Radio, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface ScanProgressIndicatorProps {
  /** Watch all user jobs */
  watchAll?: boolean;
  /** Watch a specific job */
  jobId?: string;
  /** Called when a job completes */
  onJobComplete?: (jobId: string, result: unknown) => void;
  /** Called when a job fails */
  onJobFailed?: (jobId: string, error: string) => void;
  /** Show compact version */
  compact?: boolean;
}

export function ScanProgressIndicator({
  watchAll = false,
  jobId,
  onJobComplete,
  onJobFailed,
  compact = false,
}: ScanProgressIndicatorProps) {
  const {
    isConnected,
    isConnecting,
    currentJob,
    activeJobs,
    waitingJobs,
    error,
    reconnect,
  } = useScanProgress({
    watchAll,
    jobId,
    enabled: !!(watchAll || jobId),
    onJobComplete,
    onJobFailed,
  });

  // Don't render if not watching anything
  if (!watchAll && !jobId) return null;

  // Error state
  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
          <button
            onClick={reconnect}
            className="ml-auto text-sm hover:text-red-300 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Connecting state
  if (isConnecting) {
    return (
      <div className={`flex items-center gap-2 text-slate-400 ${compact ? '' : 'p-2'}`}>
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm">Connecting...</span>
      </div>
    );
  }

  // No active jobs
  if (isConnected && activeJobs.length === 0 && waitingJobs.length === 0 && !currentJob) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Radio className="w-3 h-3" />
        <span className="text-xs">Live updates enabled</span>
      </div>
    );
  }

  // Watching a specific job
  if (jobId && currentJob) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white">
            Scanning: {currentJob.projectName}
          </span>
          <StatusBadge state={currentJob.state} />
        </div>
        
        {currentJob.progress !== undefined && (
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${currentJob.progress}%` }}
            />
          </div>
        )}
        
        <p className="text-xs text-slate-400 mt-2">{currentJob.url}</p>
      </div>
    );
  }

  // Watching all jobs
  if (watchAll && (activeJobs.length > 0 || waitingJobs.length > 0)) {
    if (compact) {
      return (
        <div className="flex items-center gap-2 text-indigo-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">
            {activeJobs.length} active, {waitingJobs.length} waiting
          </span>
        </div>
      );
    }

    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
            Scanning in Progress
          </h3>
          <span className="text-xs text-slate-400">
            {activeJobs.length + waitingJobs.length} job(s)
          </span>
        </div>

        {activeJobs.map((job) => (
          <ActiveJobCard key={job.id} job={job} />
        ))}

        {waitingJobs.length > 0 && (
          <div className="pt-2 border-t border-slate-700">
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {waitingJobs.length} job(s) waiting
            </p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function ActiveJobCard({ job }: { job: ScanJob }) {
  return (
    <div className="bg-slate-700/50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white truncate max-w-[200px]">
          {job.projectName}
        </span>
        <StatusBadge state={job.state} />
      </div>
      
      {job.progress !== undefined && (
        <div className="w-full bg-slate-600 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-indigo-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${job.progress}%` }}
          />
        </div>
      )}
      
      <p className="text-xs text-slate-400 mt-1 truncate">{job.url}</p>
    </div>
  );
}

function StatusBadge({ state }: { state?: ScanJob['state'] }) {
  switch (state) {
    case 'active':
      return (
        <span className="flex items-center gap-1 text-xs bg-indigo-600/30 text-indigo-300 px-2 py-0.5 rounded-full">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Scanning
        </span>
      );
    case 'waiting':
      return (
        <span className="flex items-center gap-1 text-xs bg-slate-600/50 text-slate-300 px-2 py-0.5 rounded-full">
          <Clock className="w-3 h-3" />
          Queued
        </span>
      );
    case 'completed':
      return (
        <span className="flex items-center gap-1 text-xs bg-emerald-600/30 text-emerald-300 px-2 py-0.5 rounded-full">
          <CheckCircle className="w-3 h-3" />
          Done
        </span>
      );
    case 'failed':
      return (
        <span className="flex items-center gap-1 text-xs bg-red-600/30 text-red-300 px-2 py-0.5 rounded-full">
          <AlertCircle className="w-3 h-3" />
          Failed
        </span>
      );
    default:
      return null;
  }
}

export default ScanProgressIndicator;
