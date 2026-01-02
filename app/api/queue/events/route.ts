/**
 * Server-Sent Events (SSE) endpoint for real-time scan updates
 * GET /api/queue/events - Stream job status updates
 * 
 * Query params:
 * - jobId: Watch a specific job
 * - all: Watch all user's jobs
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isRedisConfigured } from '@/lib/redis';

// SSE helper function
function createSSEResponse(stream: ReadableStream) {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

// Send SSE message
function sendEvent(
  controller: ReadableStreamDefaultController,
  event: string,
  data: any
) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(message));
}

export async function GET(request: NextRequest) {
  // Check auth
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Check if queue is configured
  if (!isRedisConfigured()) {
    return new Response('Queue system not configured', { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  const watchAll = searchParams.get('all') === 'true';

  // Import queue functions
  const { getJobStatus, getUserJobs } = await import('@/lib/scan-queue');
  const { prisma } = await import('@/lib/prisma');

  // Get user's internal ID
  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });

  if (!user) {
    return new Response('User not found', { status: 404 });
  }

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      sendEvent(controller, 'connected', { 
        timestamp: new Date().toISOString(),
        userId: user.id,
        watching: jobId || (watchAll ? 'all' : 'none'),
      });

      // Polling interval (every 2 seconds)
      const pollInterval = setInterval(async () => {
        try {
          if (jobId) {
            // Watch specific job
            const status = await getJobStatus(jobId);
            
            if (!status.exists) {
              sendEvent(controller, 'job-not-found', { jobId });
              clearInterval(pollInterval);
              controller.close();
              return;
            }

            sendEvent(controller, 'job-update', {
              jobId,
              ...status,
              timestamp: new Date().toISOString(),
            });

            // Close stream if job is complete or failed
            if (status.state === 'completed' || status.state === 'failed') {
              sendEvent(controller, 'job-finished', {
                jobId,
                state: status.state,
                result: status.result,
              });
              clearInterval(pollInterval);
              controller.close();
            }
          } else if (watchAll) {
            // Watch all user's jobs
            const jobs = await getUserJobs(user.id, ['waiting', 'active']);
            
            sendEvent(controller, 'jobs-update', {
              jobs,
              count: jobs.length,
              timestamp: new Date().toISOString(),
            });

            // If no active jobs, send idle event
            if (jobs.length === 0) {
              sendEvent(controller, 'idle', {
                message: 'No active jobs',
                timestamp: new Date().toISOString(),
              });
            }
          } else {
            // Send heartbeat
            sendEvent(controller, 'heartbeat', {
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error('[SSE] Polling error:', error);
          sendEvent(controller, 'error', {
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }, 2000);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        controller.close();
      });

      // Timeout after 5 minutes to prevent zombie connections
      setTimeout(() => {
        sendEvent(controller, 'timeout', {
          message: 'Connection timeout. Please reconnect.',
        });
        clearInterval(pollInterval);
        controller.close();
      }, 5 * 60 * 1000);
    },
  });

  return createSSEResponse(stream);
}
