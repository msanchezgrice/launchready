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
}> {
  const queue = getScanQueue();
  const counts = await queue.getJobCounts();
  
  return {
    waiting: counts.waiting || 0,
    active: counts.active || 0,
    completed: counts.completed || 0,
    failed: counts.failed || 0,
    delayed: counts.delayed || 0,
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
    const { projectId, projectName, url, userId, trigger } = job.data;

    console.log(`[ScanWorker] Processing job ${job.id}: ${url}`);

    try {
      // Update progress: starting
      await job.progress(10);

      // Run the scan
      const scanResult = await scanProject(url);

      // Update progress: scan complete
      await job.progress(90);

      const duration = Date.now() - startTime;

      let previousScore: number | undefined;

      // Store result in database (if Prisma is available)
      try {
        const { prisma } = await import('./prisma');
        
        // Get previous scan for score comparison
        const previousScan = await prisma.scan.findFirst({
          where: { projectId },
          orderBy: { scannedAt: 'desc' },
        });
        previousScore = previousScan?.score;
        
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

        // Send email and webhook notifications
        try {
          const { 
            sendScanCompleteEmail, 
            sendScoreDropAlert, 
            isEmailConfigured 
          } = await import('./email');
          const { 
            sendWebhookNotification, 
            sendScoreDropWebhook 
          } = await import('./webhooks');
          
          // Get user details for notifications
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { 
              email: true, 
              scoreDropAlerts: true, 
              scanCompleteNotify: true,
              webhookUrl: true,
              plan: true,
            },
          });

          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://launchready.me';
          const scanUrl = `${appUrl}/projects/${projectId}`;

          // Prepare phases data for notifications
          const phasesData = scanResult.phases.map(p => ({
            name: p.phaseName,
            score: p.score,
            maxScore: p.maxScore,
            status: (p.score / p.maxScore >= 0.7 ? 'pass' : 
                    p.score / p.maxScore >= 0.5 ? 'warning' : 'fail') as 'pass' | 'warning' | 'fail',
          }));

          // Send webhook notification (Pro Plus and Enterprise only)
          const webhookUrl = (user as { webhookUrl?: string })?.webhookUrl;
          const userPlan = (user as { plan?: string })?.plan;
          if (webhookUrl && (userPlan === 'pro_plus' || userPlan === 'enterprise')) {
            const change = previousScore !== undefined 
              ? scanResult.score - previousScore 
              : undefined;

            await sendWebhookNotification(webhookUrl, {
              projectName,
              projectUrl: url,
              score: scanResult.score,
              previousScore,
              change,
              scanUrl,
              trigger,
              timestamp: new Date().toISOString(),
              phases: phasesData,
            });
            console.log(`[ScanWorker] Sent webhook notification for ${projectName}`);

            // Send score drop webhook alert
            if (previousScore !== undefined) {
              const dropAmount = previousScore - scanResult.score;
              if (dropAmount >= 5) {
                await sendScoreDropWebhook(webhookUrl, {
                  projectName,
                  projectUrl: url,
                  previousScore,
                  currentScore: scanResult.score,
                  dropAmount,
                  scanUrl,
                });
                console.log(`[ScanWorker] Sent score drop webhook for ${projectName}`);
              }
            }
          }

          // Send email notifications
          if (isEmailConfigured() && user?.email) {
            // Check for score drop alert (>10 points)
            const scoreDropAlerts = (user as unknown as { scoreDropAlerts?: boolean }).scoreDropAlerts ?? true;
            if (scoreDropAlerts && previousScore !== undefined) {
              const dropAmount = previousScore - scanResult.score;
              if (dropAmount >= 10) {
                await sendScoreDropAlert(user.email, {
                  projectName,
                  projectUrl: url,
                  currentScore: scanResult.score,
                  previousScore,
                  dropAmount,
                  scanUrl,
                });
                console.log(`[ScanWorker] Sent score drop email alert for ${projectName}`);
              }
            }

            // Send scan complete notification (only for auto-scans or if enabled)
            const scanCompleteNotify = (user as unknown as { scanCompleteNotify?: boolean }).scanCompleteNotify ?? true;
            if (scanCompleteNotify && trigger === 'auto-scan') {
              await sendScanCompleteEmail(user.email, {
                projectName,
                projectUrl: url,
                score: scanResult.score,
                previousScore,
                phases: phasesData.map(p => ({ ...p, status: p.status === 'warning' ? 'warn' : p.status })),
                scanUrl,
              });
              console.log(`[ScanWorker] Sent scan complete email for ${projectName}`);
            }
          }
        } catch (notificationError) {
          // Log but don't fail the job if notifications fail
          console.error('[ScanWorker] Failed to send notifications:', notificationError);
        }
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

/**
 * Cancel a waiting or delayed job
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  const queue = getScanQueue();
  const job = await queue.getJob(jobId);

  if (!job) {
    console.log(`[ScanQueue] Job ${jobId} not found`);
    return false;
  }

  const state = await job.getState();

  // Can only cancel waiting or delayed jobs
  if (state !== 'waiting' && state !== 'delayed') {
    console.log(`[ScanQueue] Cannot cancel job ${jobId} in state ${state}`);
    return false;
  }

  await job.remove();
  console.log(`[ScanQueue] Cancelled job ${jobId}`);
  return true;
}

/**
 * Retry a failed job
 */
export async function retryJob(jobId: string): Promise<boolean> {
  const queue = getScanQueue();
  const job = await queue.getJob(jobId);

  if (!job) {
    console.log(`[ScanQueue] Job ${jobId} not found`);
    return false;
  }

  const state = await job.getState();

  // Can only retry failed jobs
  if (state !== 'failed') {
    console.log(`[ScanQueue] Cannot retry job ${jobId} in state ${state}`);
    return false;
  }

  await job.retry();
  console.log(`[ScanQueue] Retrying job ${jobId}`);
  return true;
}
