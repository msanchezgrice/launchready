/**
 * Weekly Digest Cron Job Endpoint
 * 
 * Sends weekly summary emails to users who have weeklyDigest enabled.
 * 
 * Schedule: 0 9 * * 1 (Every Monday at 9am UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendWeeklyDigest, isEmailConfigured } from '@/lib/email';

export const runtime = 'nodejs';
export const maxDuration = 300; // Allow up to 5 minutes for sending all emails

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // In development, allow without secret
  if (process.env.NODE_ENV === 'production' && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log('[Weekly Digest] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Check if email is configured
  if (!isEmailConfigured()) {
    console.log('[Weekly Digest] Email service not configured');
    return NextResponse.json({
      message: 'Email service not configured',
      skipped: true,
    });
  }

  const now = new Date();
  console.log(`[Weekly Digest] Running at ${now.toISOString()}`);

  try {
    // Get all users with weekly digest enabled who have projects
    const users = await prisma.user.findMany({
      where: {
        // Only send to users with weeklyDigest enabled (default is true)
        // Using raw query since the field may not exist yet
      },
      include: {
        projects: {
          include: {
            scans: {
              orderBy: { scannedAt: 'desc' },
              take: 2, // Current and previous scan for comparison
            },
          },
        },
      },
    });

    const results: Array<{
      userId: string;
      email: string;
      status: 'sent' | 'skipped' | 'failed';
      reason?: string;
    }> = [];

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://launchready.me';

    for (const user of users) {
      // Skip users without email
      if (!user.email) {
        results.push({
          userId: user.id,
          email: 'N/A',
          status: 'skipped',
          reason: 'No email address',
        });
        continue;
      }

      // Skip users with no projects
      if (user.projects.length === 0) {
        results.push({
          userId: user.id,
          email: user.email,
          status: 'skipped',
          reason: 'No projects',
        });
        continue;
      }

      // Check if user has weeklyDigest enabled (default true)
      const weeklyDigest = (user as unknown as { weeklyDigest?: boolean }).weeklyDigest ?? true;
      if (!weeklyDigest) {
        results.push({
          userId: user.id,
          email: user.email,
          status: 'skipped',
          reason: 'Weekly digest disabled',
        });
        continue;
      }

      // Build project data for digest
      const projectData = user.projects.map((project) => {
        const currentScan = project.scans[0];
        const previousScan = project.scans[1];
        const currentScore = currentScan?.score || 0;
        const previousScore = previousScan?.score;
        const change = previousScore !== undefined ? currentScore - previousScore : 0;

        return {
          name: project.name,
          url: project.url,
          currentScore,
          previousScore,
          change,
          lastScanned: currentScan?.scannedAt?.toISOString() || 'Never',
        };
      });

      // Send digest email
      const result = await sendWeeklyDigest(user.email, {
        userName: user.name || 'there',
        projects: projectData,
        dashboardUrl: `${appUrl}/dashboard`,
      });

      results.push({
        userId: user.id,
        email: user.email,
        status: result.success ? 'sent' : 'failed',
        reason: result.error,
      });
    }

    const sent = results.filter((r) => r.status === 'sent').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    console.log(`[Weekly Digest] Complete: ${sent} sent, ${skipped} skipped, ${failed} failed`);

    return NextResponse.json({
      message: 'Weekly digest processing complete',
      timestamp: now.toISOString(),
      total: users.length,
      sent,
      skipped,
      failed,
      results,
    });
  } catch (error) {
    console.error('[Weekly Digest] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process weekly digest' },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
