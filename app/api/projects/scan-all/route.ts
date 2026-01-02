/**
 * Scan All Projects API
 * POST /api/projects/scan-all - Queue scans for all user's projects
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { queueBulkScans } from '@/lib/scan-queue';
import { isRedisConfigured } from '@/lib/redis';
import { getPlanLimits } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if queue is available
    if (!isRedisConfigured()) {
      return NextResponse.json(
        { 
          error: 'Queue system not available',
          message: 'Bulk scanning requires the queue system to be configured.',
        },
        { status: 503 }
      );
    }

    // Get user and their projects
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      include: {
        projects: {
          select: {
            id: true,
            url: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check plan limits
    const limits = getPlanLimits(user.plan);
    
    // Free tier users can only scan manually one at a time
    if (user.plan === 'free') {
      return NextResponse.json(
        { 
          error: 'Plan limit',
          message: 'Bulk scanning is available on Pro plans and above.',
          upgrade: true,
        },
        { status: 403 }
      );
    }

    // No projects to scan
    if (user.projects.length === 0) {
      return NextResponse.json(
        { error: 'No projects', message: 'You have no projects to scan.' },
        { status: 400 }
      );
    }

    // Parse request body for optional filters
    const body = await request.json().catch(() => ({}));
    const { projectIds } = body as { projectIds?: string[] };

    // Filter projects if specific IDs provided
    let projectsToScan = user.projects;
    if (projectIds && projectIds.length > 0) {
      projectsToScan = user.projects.filter((p) => projectIds.includes(p.id));
    }

    if (projectsToScan.length === 0) {
      return NextResponse.json(
        { error: 'No matching projects', message: 'None of the specified project IDs match your projects.' },
        { status: 400 }
      );
    }

    // Queue all scans
    const result = await queueBulkScans(
      projectsToScan.map((p) => ({ projectId: p.id, url: p.url })),
      user.id,
      'manual'
    );

    return NextResponse.json({
      success: true,
      queued: result.queued,
      skipped: result.skipped,
      jobs: result.jobs.map((j) => ({
        ...j,
        projectName: projectsToScan.find((p) => p.id === j.projectId)?.name,
      })),
      message: `Queued ${result.queued} project${result.queued !== 1 ? 's' : ''} for scanning.`,
    });
  } catch (error) {
    console.error('[API] Scan all projects error:', error);
    return NextResponse.json(
      { error: 'Failed to queue scans' },
      { status: 500 }
    );
  }
}

// GET - Get status of bulk scan operation
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isRedisConfigured()) {
      return NextResponse.json({
        available: false,
        message: 'Queue system not configured',
      });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Import dynamically to avoid initialization issues
    const { getUserJobs } = await import('@/lib/scan-queue');
    const jobs = await getUserJobs(user.id, ['waiting', 'active', 'completed', 'failed']);

    // Get project names for context
    const projectIds = [...new Set(jobs.map((j) => j.projectId))];
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true },
    });

    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    return NextResponse.json({
      available: true,
      jobs: jobs.map((j) => ({
        ...j,
        projectName: projectMap.get(j.projectId) || 'Unknown',
      })),
      summary: {
        total: jobs.length,
        waiting: jobs.filter((j) => j.state === 'waiting').length,
        active: jobs.filter((j) => j.state === 'active').length,
        completed: jobs.filter((j) => j.state === 'completed').length,
        failed: jobs.filter((j) => j.state === 'failed').length,
      },
    });
  } catch (error) {
    console.error('[API] Get bulk scan status error:', error);
    return NextResponse.json(
      { error: 'Failed to get scan status' },
      { status: 500 }
    );
  }
}
