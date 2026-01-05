/**
 * Auto-scan Cron Job Endpoint
 * 
 * Called by Vercel Cron at scheduled times to trigger automatic scans
 * for Pro/Pro Plus/Enterprise users with auto-scan enabled.
 * 
 * Schedule: 0 6,12,18 * * * (6am, 12pm, 6pm UTC daily)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addScanJob } from '@/lib/scan-queue';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for processing

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // In development, allow without secret
  if (process.env.NODE_ENV === 'production' && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log('[Auto-scan] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const now = new Date();
  const currentHour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay();
  
  // Determine which schedules to run based on current time
  const schedulesToRun = getSchedulesToRun(currentHour, dayOfWeek);
  
  console.log(`[Auto-scan] Running at ${now.toISOString()}`);
  console.log(`[Auto-scan] Hour: ${currentHour} UTC, Day: ${dayOfWeek}`);
  console.log(`[Auto-scan] Schedules to run: ${schedulesToRun.join(', ') || 'none'}`);

  if (schedulesToRun.length === 0) {
    return NextResponse.json({
      message: 'No schedules match current time',
      timestamp: now.toISOString(),
      processed: 0,
    });
  }

  try {
    // Find all projects with auto-scan enabled and matching schedule
    const projects = await prisma.project.findMany({
      where: {
        autoScanEnabled: true,
        autoScanSchedule: { in: schedulesToRun },
        user: {
          plan: { in: ['pro', 'pro_plus', 'enterprise'] },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            plan: true,
            scoreDropAlerts: true,
          },
        },
      },
    });

    console.log(`[Auto-scan] Found ${projects.length} projects to scan`);

    const results: Array<{
      projectId: string;
      projectName: string;
      jobId?: string;
      status: 'queued' | 'failed';
      error?: string;
    }> = [];

    for (const project of projects) {
      try {
        const job = await addScanJob({
          projectId: project.id,
          projectName: project.name,
          url: project.url,
          userId: project.userId,
          trigger: 'auto-scan',
        });

        results.push({
          projectId: project.id,
          projectName: project.name,
          jobId: job.id?.toString(),
          status: 'queued',
        });

        console.log(`[Auto-scan] Queued: ${project.name} (${project.url})`);
      } catch (error) {
        console.error(`[Auto-scan] Failed to queue ${project.name}:`, error);
        results.push({
          projectId: project.id,
          projectName: project.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const queued = results.filter((r) => r.status === 'queued').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    console.log(`[Auto-scan] Complete: ${queued} queued, ${failed} failed`);

    return NextResponse.json({
      message: `Processed ${projects.length} projects`,
      timestamp: now.toISOString(),
      schedules: schedulesToRun,
      processed: projects.length,
      queued,
      failed,
      results,
    });
  } catch (error) {
    console.error('[Auto-scan] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process auto-scans' },
      { status: 500 }
    );
  }
}

/**
 * Get list of schedule keys that should run at the current time
 */
function getSchedulesToRun(hour: number, dayOfWeek: number): string[] {
  const schedules: string[] = [];

  // Daily schedules
  if (hour === 6) schedules.push('daily-6am');
  if (hour === 12) schedules.push('daily-12pm');
  if (hour === 18) schedules.push('daily-6pm');

  // Weekly schedule (Monday = 1 in JS)
  if (dayOfWeek === 1 && hour === 6) {
    schedules.push('weekly-mon');
  }

  return schedules;
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
