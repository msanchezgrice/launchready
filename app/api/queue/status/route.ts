/**
 * Queue Status API
 * GET /api/queue/status - Get overall queue statistics
 * GET /api/queue/status?jobId=xxx - Get specific job status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isRedisConfigured } from '@/lib/redis';
import { getQueueStats, getJobStatus, getUserJobs } from '@/lib/scan-queue';

export async function GET(request: NextRequest) {
  try {
    // Check if queue is configured
    if (!isRedisConfigured()) {
      return NextResponse.json(
        { 
          error: 'Queue not configured',
          message: 'Redis/Upstash is not set up. Queue features are disabled.',
          configured: false,
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    // Get specific job status
    if (jobId) {
      const status = await getJobStatus(jobId);
      
      if (!status) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        job: status,
        configured: true,
      });
    }

    // Check authentication for user-specific jobs
    const { userId } = await auth();

    // Get overall queue stats
    const stats = await getQueueStats();

    // If authenticated, also get user's jobs
    let userJobs = null;
    if (userId) {
      try {
        const jobs = await getUserJobs(userId);
        userJobs = {
          waiting: jobs.waiting.map(j => ({
            id: j.id,
            projectName: j.data.projectName,
            url: j.data.url,
            timestamp: j.timestamp,
          })),
          active: jobs.active.map(j => ({
            id: j.id,
            projectName: j.data.projectName,
            url: j.data.url,
            progress: j.progress(),
            timestamp: j.timestamp,
          })),
          completed: jobs.completed.slice(0, 5).map(j => ({
            id: j.id,
            projectName: j.data.projectName,
            url: j.data.url,
            result: j.returnvalue,
            timestamp: j.timestamp,
          })),
          failed: jobs.failed.map(j => ({
            id: j.id,
            projectName: j.data.projectName,
            url: j.data.url,
            error: j.failedReason,
            attemptsMade: j.attemptsMade,
            timestamp: j.timestamp,
          })),
        };
      } catch (error) {
        console.error('[QueueStatus] Error fetching user jobs:', error);
      }
    }

    return NextResponse.json({
      configured: true,
      stats,
      userJobs,
    });
  } catch (error) {
    console.error('[QueueStatus] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get queue status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
