/**
 * Scan All Projects API
 * POST /api/queue/scan-all - Queue scans for all user's projects
 * 
 * This is a Pro+ feature that allows batch scanning of multiple projects
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { isRedisConfigured } from '@/lib/redis';
import { addBatchScanJobs, ScanJobData } from '@/lib/scan-queue';
import { getPlanLimits } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if queue is configured
    if (!isRedisConfigured()) {
      return NextResponse.json(
        { 
          error: 'Queue not available',
          message: 'Batch scanning requires Redis. Please configure UPSTASH_REDIS_URL.',
        },
        { status: 503 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check plan limits - batch scanning is Pro feature
    const limits = getPlanLimits(user.plan);
    if (!limits.autoScans && user.plan === 'free') {
      return NextResponse.json(
        { 
          error: 'Upgrade required',
          message: 'Batch scanning is a Pro feature. Upgrade to unlock.',
          requiredPlan: 'pro',
        },
        { status: 403 }
      );
    }

    // Check if user has any projects
    if (user.projects.length === 0) {
      return NextResponse.json(
        { 
          error: 'No projects',
          message: 'Add some projects first before batch scanning.',
        },
        { status: 400 }
      );
    }

    // Parse optional project IDs filter from body
    let projectIds: string[] | undefined;
    try {
      const body = await request.json();
      projectIds = body.projectIds;
    } catch {
      // No body, scan all projects
    }

    // Filter projects if specific IDs provided
    let projectsToScan = user.projects;
    if (projectIds && Array.isArray(projectIds)) {
      projectsToScan = user.projects.filter(p => projectIds!.includes(p.id));
    }

    if (projectsToScan.length === 0) {
      return NextResponse.json(
        { 
          error: 'No matching projects',
          message: 'None of the specified project IDs were found.',
        },
        { status: 400 }
      );
    }

    // Create scan jobs for each project
    const jobsData: ScanJobData[] = projectsToScan.map(project => ({
      projectId: project.id,
      projectName: project.name,
      url: project.url,
      userId: user.id,
      trigger: 'batch' as const,
    }));

    // Add all jobs to queue
    const jobs = await addBatchScanJobs(jobsData);

    // Return job IDs for tracking
    return NextResponse.json({
      success: true,
      message: `Queued ${jobs.length} scan${jobs.length === 1 ? '' : 's'}`,
      jobs: jobs.map(job => ({
        id: job.id,
        projectId: job.data.projectId,
        projectName: job.data.projectName,
        url: job.data.url,
      })),
      totalQueued: jobs.length,
    });
  } catch (error) {
    console.error('[ScanAll] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to queue scans',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
