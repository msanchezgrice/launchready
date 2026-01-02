/**
 * Queue Worker Script
 * 
 * This file initializes and starts the scan queue worker.
 * 
 * In development, the worker runs in the same process.
 * In production, consider running this as a separate process or using:
 * - Vercel Cron Jobs
 * - Railway/Render background workers
 * - Dedicated worker dyno
 * 
 * Usage:
 *   Development: Import in middleware or API route
 *   Production: npm run worker
 */

import { startScanWorker } from './scan-queue';
import { isRedisConfigured as checkRedis } from './redis';

// Worker configuration
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);

let workerStarted = false;

/**
 * Initialize the worker if Redis is configured
 * Safe to call multiple times - only starts once
 */
export function initializeWorker(): boolean {
  if (workerStarted) {
    console.log('[Worker] Already initialized');
    return true;
  }

  if (!checkRedis()) {
    console.log('[Worker] Redis not configured, skipping worker initialization');
    return false;
  }

  try {
    startScanWorker(WORKER_CONCURRENCY);
    workerStarted = true;
    console.log(`[Worker] Initialized with concurrency ${WORKER_CONCURRENCY}`);
    return true;
  } catch (error) {
    console.error('[Worker] Failed to initialize:', error);
    return false;
  }
}

/**
 * Check if worker is running
 */
export function isWorkerRunning(): boolean {
  return workerStarted;
}

/**
 * Start worker as standalone process
 * Called when running: npm run worker
 */
export async function startStandaloneWorker(): Promise<void> {
  console.log('[Worker] Starting as standalone process...');
  
  if (!checkRedis()) {
    console.error('[Worker] UPSTASH_REDIS_URL not configured. Exiting.');
    process.exit(1);
  }

  initializeWorker();

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('[Worker] Shutting down...');
    const { closeQueue } = await import('./scan-queue');
    await closeQueue();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Keep process alive
  console.log('[Worker] Running... Press Ctrl+C to stop.');
}

// Only auto-start when explicitly running as worker script
// Check for explicit worker execution context to avoid running during Next.js build
const isWorkerScript = typeof process !== 'undefined' && 
  process.argv[1]?.endsWith('worker.ts') &&
  !process.env.NEXT_RUNTIME && // Don't start during Next.js build/runtime
  !process.env.npm_lifecycle_event?.includes('build'); // Don't start during npm run build

if (isWorkerScript) {
  startStandaloneWorker();
}
