/**
 * Job Operations API
 * GET /api/queue/job/[jobId] - Get job details
 * DELETE /api/queue/job/[jobId] - Cancel a job
 * POST /api/queue/job/[jobId]/retry - Retry a failed job
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJobStatus, cancelJob, retryJob } from '@/lib/scan-queue';
import { isRedisConfigured } from '@/lib/redis';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

// GET - Get job details
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    if (!isRedisConfigured()) {
      return NextResponse.json(
        { error: 'Queue system not configured' },
        { status: 503 }
      );
    }

    const { jobId } = await params;
    const status = await getJobStatus(jobId);

    if (!status) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('[API] Get job error:', error);
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel a job
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isRedisConfigured()) {
      return NextResponse.json(
        { error: 'Queue system not configured' },
        { status: 503 }
      );
    }

    const { jobId } = await params;
    const cancelled = await cancelJob(jobId);

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Job cannot be cancelled (already running or completed)' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Job cancelled' });
  } catch (error) {
    console.error('[API] Cancel job error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel job' },
      { status: 500 }
    );
  }
}

// POST - Retry a failed job (handled via separate route)
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isRedisConfigured()) {
      return NextResponse.json(
        { error: 'Queue system not configured' },
        { status: 503 }
      );
    }

    const { jobId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (action === 'retry') {
      const retried = await retryJob(jobId);

      if (!retried) {
        return NextResponse.json(
          { error: 'Job cannot be retried (not in failed state)' },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, message: 'Job queued for retry' });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use { "action": "retry" }' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Job action error:', error);
    return NextResponse.json(
      { error: 'Failed to perform job action' },
      { status: 500 }
    );
  }
}
