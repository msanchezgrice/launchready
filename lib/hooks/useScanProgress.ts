/**
 * Custom hook for real-time scan progress via SSE
 * 
 * Usage:
 *   const { isConnected, currentJob, activeJobs } = useScanProgress({ watchAll: true });
 *   const { isConnected, currentJob } = useScanProgress({ jobId: 'specific-job-id' });
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ScanJob {
  id: string;
  projectName: string;
  url: string;
  progress?: number;
  state?: 'waiting' | 'active' | 'completed' | 'failed';
}

export interface ScanProgressState {
  isConnected: boolean;
  isConnecting: boolean;
  currentJob: ScanJob | null;
  activeJobs: ScanJob[];
  waitingJobs: ScanJob[];
  lastEvent: string | null;
  error: string | null;
}

interface UseScanProgressOptions {
  jobId?: string;
  watchAll?: boolean;
  enabled?: boolean;
  onJobComplete?: (jobId: string, result: unknown) => void;
  onJobFailed?: (jobId: string, error: string) => void;
}

export function useScanProgress(options: UseScanProgressOptions = {}): ScanProgressState & {
  reconnect: () => void;
  disconnect: () => void;
} {
  const { jobId, watchAll = false, enabled = true, onJobComplete, onJobFailed } = options;
  
  const [state, setState] = useState<ScanProgressState>({
    isConnected: false,
    isConnecting: false,
    currentJob: null,
    activeJobs: [],
    waitingJobs: [],
    lastEvent: null,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
    }));
  }, []);

  const connect = useCallback(() => {
    // Don't connect if disabled or already connected
    if (!enabled) return;
    if (eventSourceRef.current?.readyState === EventSource.OPEN) return;

    // Build URL with params
    const params = new URLSearchParams();
    if (jobId) params.set('jobId', jobId);
    if (watchAll) params.set('all', 'true');
    const url = `/api/queue/events?${params.toString()}`;

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      reconnectAttempts.current = 0;
      setState((prev) => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        error: null,
      }));
    };

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;
      
      setState((prev) => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
      }));

      // Attempt reconnection with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      } else {
        setState((prev) => ({
          ...prev,
          error: 'Connection lost. Please refresh the page.',
        }));
      }
    };

    // Handle SSE events
    eventSource.addEventListener('connected', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setState((prev) => ({
        ...prev,
        lastEvent: 'connected',
        isConnected: true,
      }));
      console.log('[SSE] Connected:', data);
    });

    eventSource.addEventListener('job-update', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setState((prev) => ({
        ...prev,
        lastEvent: 'job-update',
        currentJob: {
          id: data.jobId,
          projectName: data.projectName,
          url: data.url,
          progress: data.progress,
          state: data.state,
        },
      }));
    });

    eventSource.addEventListener('jobs-update', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setState((prev) => ({
        ...prev,
        lastEvent: 'jobs-update',
        activeJobs: data.active || [],
        waitingJobs: data.waiting || [],
      }));
    });

    eventSource.addEventListener('job-finished', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setState((prev) => ({
        ...prev,
        lastEvent: 'job-finished',
        currentJob: prev.currentJob
          ? { ...prev.currentJob, state: data.state }
          : null,
      }));
      
      if (data.state === 'completed' && onJobComplete) {
        onJobComplete(data.jobId, data.result);
      } else if (data.state === 'failed' && onJobFailed) {
        onJobFailed(data.jobId, data.result?.error || 'Unknown error');
      }
    });

    eventSource.addEventListener('job-not-found', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setState((prev) => ({
        ...prev,
        lastEvent: 'job-not-found',
        error: `Job ${data.jobId} not found`,
        currentJob: null,
      }));
    });

    eventSource.addEventListener('idle', () => {
      setState((prev) => ({
        ...prev,
        lastEvent: 'idle',
        activeJobs: [],
        waitingJobs: [],
      }));
    });

    eventSource.addEventListener('error', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setState((prev) => ({
        ...prev,
        lastEvent: 'error',
        error: data.message,
      }));
    });

    eventSource.addEventListener('timeout', () => {
      setState((prev) => ({
        ...prev,
        lastEvent: 'timeout',
        error: 'Connection timed out. Reconnecting...',
      }));
      disconnect();
      // Auto-reconnect after timeout
      setTimeout(connect, 1000);
    });

    eventSource.addEventListener('heartbeat', () => {
      setState((prev) => ({
        ...prev,
        lastEvent: 'heartbeat',
      }));
    });
  }, [enabled, jobId, watchAll, onJobComplete, onJobFailed, disconnect]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled && (jobId || watchAll)) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, jobId, watchAll, connect, disconnect]);

  return {
    ...state,
    reconnect: connect,
    disconnect,
  };
}

export default useScanProgress;
