/**
 * Scan Queue - Bull-based job queue for scan processing
 * Handles async scanning with retries, progress tracking, and concurrency control
 */

import Queue, { Job, JobOptions } from 'bull';
import { getBullRedisOptions, isRedisConfigured } from './redis';
import { scanProject, ScanResult } from './scanner';

// Job data structure
export interface ScanJobData {
  projectId: string;
  projectName: string;
  url: string;
  userId: string;
  trigger: 'manual' | 'auto-scan' | 'api' | 'batch';
}

// Job result structure
export interface ScanJobResult {
  success: boolean;
  scanResult?: ScanResult;
  error?: string;
  duration: number;
}

// Queue instance (lazy initialized)
let scanQueueInstance: Queue.Queue<ScanJobData> | null = null;

/**
 * Get or create the scan queue instance
 */
export function getScanQueue(): Queue.Queue<ScanJobData> {
  if (scanQueueInstance) {
    return scanQueueInstance;
  }

  if (!isRedisConfigured()) {
    throw new Error(
      'Scan queue requires Redis. Set UPSTASH_REDIS_URL environment variable.'
    );
  }

  const redisOpts = getBullRedisOptions();

  scanQueueInstance = new Queue<ScanJobData>('scan-queue', {
    redis: redisOpts,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5s, 10s, 20s
      },
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 50, // Keep last 50 failed jobs
      timeout: 120000, // 2 minute timeout per job
    },
  });

  // Set up event listeners
  scanQueueInstance.on('error', (error) => {
    console.error('[ScanQueue] Queue error:', error);
  });

  scanQueueInstance.on('waiting', (jobId) => {
    console.log(`[ScanQueue] Job ${jobId} waiting`);
  });

  scanQueueInstance.on('active', (job) => {
    console.log(`[ScanQueue] Job ${job.id} started for ${job.data.url}`);
  });

  scanQueueInstance.on('completed', (job, result: ScanJobResult) => {
    console.log(
      `[ScanQueue] Job ${job.id} completed: ${result.success ? 'success' : 'failed'} (${result.duration}ms)`
    );
  });

  scanQueueInstance.on('failed', (job, error) => {
    console.error(`[ScanQueue] Job ${job?.id} failed:`, error.message);
  });

  scanQueueInstance.on('stalled', (job) => {
    console.warn(`[ScanQueue] Job ${job.id} stalled, will be reprocessed`);
  });

  return scanQueueInstance;
}

/**
 * Add a scan job to the queue
 */
export async function addScanJob(
  data: ScanJobData,
  options?: Partial<JobOptions>
): Promise<Job<ScanJobData>> {
  const queue = getScanQueue();
  
  const job = await queue.add(data, {
    ...options,
    // Use project ID as job ID to prevent duplicates
    jobId: `scan-${data.projectId}-${Date.now()}`,
  });

  console.log(`[ScanQueue] Added job ${job.id} for ${data.url}`);
  return job;
}

/**
 * Add multiple scan jobs (batch)
 */
export async function addBatchScanJobs(
  jobs: ScanJobData[],
  options?: Partial<JobOptions>
): Promise<Job<ScanJobData>[]> {
  const queue = getScanQueue();
  
  const addedJobs = await Promise.all(
    jobs.map((data) =>
      queue.add(data, {
        ...options,
        jobId: `scan-${data.projectId}-${Date.now()}`,
      })
    )
  );

  console.log(`[ScanQueue] Added ${addedJobs.length} batch jobs`);
  return addedJobs;
}

/**
 * Get job status by ID
 */
export async function getJobStatus(jobId: string): Promise<{
  id: string;
  state: string;
  progress: number;
  data: ScanJobData;
  result?: ScanJobResult;
  failedReason?: string;
  attemptsMade: number;
  timestamp: number;
} | null> {
  const queue = getScanQueue();
  const job = await queue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();

  return {
    id: job.id?.toString() || jobId,
    state,
    progress: job.progress() as number,
    data: job.data,
    result: job.returnvalue as ScanJobResult | undefined,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
  };
}

/**
 * Get all jobs for a user
 */
export async function getUserJobs(userId: string): Promise<{
  waiting: Job<ScanJobData>[];
  active: Job<ScanJobData>[];
  completed: Job<ScanJobData>[];
  failed: Job<ScanJobData>[];
}> {
  const queue = getScanQueue();

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getJobs(['waiting'], 0, 50),
    queue.getJobs(['active'], 0, 10),
    queue.getJobs(['completed'], 0, 20),
    queue.getJobs(['failed'], 0, 10),
  ]);

  // Filter by user
  const filterByUser = (jobs: Job<ScanJobData>[]) =>
    jobs.filter((job) => job.data.userId === userId);

  return {
    waiting: filterByUser(waiting),
    active: filterByUser(active),
    completed: filterByUser(completed),
    failed: filterByUser(failed),
  };
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}> {
  const queue = getScanQueue();
  const counts = await queue.getJobCounts();
  
  return {
    waiting: counts.waiting || 0,
    active: counts.active || 0,
    completed: counts.completed || 0,
    failed: counts.failed || 0,
    delayed: counts.delayed || 0,
    paused: counts.paused || 0,
  };
}

/**
 * Process scan jobs - call this to start the worker
 * Should be run in a separate process or on app startup
 */
export function startScanWorker(concurrency: number = 2): void {
  const queue = getScanQueue();

  queue.process(concurrency, async (job: Job<ScanJobData>) => {
    const startTime = Date.now();
    const { projectId, url, trigger } = job.data;

    console.log(`[ScanWorker] Processing job ${job.id}: ${url}`);

    try {
      // Update progress: starting
      await job.progress(10);

      // Run the scan
      const scanResult = await scanProject(url);

      // Update progress: scan complete
      await job.progress(90);

      const duration = Date.now() - startTime;

      // Store result in database (if Prisma is available)
      try {
        const { prisma } = await import('./prisma');
        
        // Create scan record
        const scan = await prisma.scan.create({
          data: {
            projectId,
            score: scanResult.score,
            trigger,
            metadata: {
              duration,
              jobId: job.id?.toString(),
            },
            phases: {
              create: scanResult.phases.map((phase) => ({
                phaseName: phase.phaseName,
                score: phase.score,
                maxScore: phase.maxScore,
                findings: phase.findings as object,
                recommendations: phase.recommendations as object,
              })),
            },
          },
        });

        console.log(`[ScanWorker] Saved scan ${scan.id} for project ${projectId}`);
      } catch (dbError) {
        // Log but don't fail the job if DB save fails
        console.error('[ScanWorker] Failed to save scan to database:', dbError);
      }

      // Update progress: complete
      await job.progress(100);

      const result: ScanJobResult = {
        success: true,
        scanResult,
        duration,
      };

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error(`[ScanWorker] Job ${job.id} failed:`, errorMessage);

      const result: ScanJobResult = {
        success: false,
        error: errorMessage,
        duration,
      };

      // Throw to trigger retry
      throw new Error(errorMessage);
    }
  });

  console.log(`[ScanWorker] Started with concurrency ${concurrency}`);
}

/**
 * Clean up old jobs
 */
export async function cleanupOldJobs(): Promise<{
  completed: number;
  failed: number;
}> {
  const queue = getScanQueue();
  
  // Clean jobs older than 24 hours
  const gracePeriod = 24 * 60 * 60 * 1000;
  
  const [completedCount, failedCount] = await Promise.all([
    queue.clean(gracePeriod, 'completed'),
    queue.clean(gracePeriod, 'failed'),
  ]);

  console.log(`[ScanQueue] Cleaned ${completedCount.length} completed, ${failedCount.length} failed jobs`);

  return {
    completed: completedCount.length,
    failed: failedCount.length,
  };
}

/**
 * Pause the queue
 */
export async function pauseQueue(): Promise<void> {
  const queue = getScanQueue();
  await queue.pause();
  console.log('[ScanQueue] Queue paused');
}

/**
 * Resume the queue
 */
export async function resumeQueue(): Promise<void> {
  const queue = getScanQueue();
  await queue.resume();
  console.log('[ScanQueue] Queue resumed');
}

/**
 * Close the queue connection
 */
export async function closeQueue(): Promise<void> {
  if (scanQueueInstance) {
    await scanQueueInstance.close();
    scanQueueInstance = null;
    console.log('[ScanQueue] Queue closed');
  }
}
