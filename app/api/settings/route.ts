/**
 * User Settings API
 * 
 * GET /api/settings - Get current user settings
 * PATCH /api/settings - Update user settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

// GET /api/settings - Get user settings
export async function GET() {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            url: true,
            autoScanEnabled: true,
            autoScanSchedule: true,
            githubRepo: true,
            vercelProject: true,
          },
        },
      },
    });

    if (!dbUser) {
      // Create user if doesn't exist
      const newUser = await prisma.user.create({
        data: {
          clerkId: user.id,
          email: user.primaryEmailAddress?.emailAddress || '',
          name: user.fullName || null,
          plan: 'free',
        },
        include: {
          projects: {
            select: {
              id: true,
              name: true,
              url: true,
              autoScanEnabled: true,
              autoScanSchedule: true,
              githubRepo: true,
              vercelProject: true,
            },
          },
        },
      });

      return NextResponse.json({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        plan: newUser.plan,
        scoreDropAlerts: true,
        weeklyDigest: true,
        scanCompleteNotify: true,
        projects: newUser.projects,
      });
    }

    return NextResponse.json({
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      plan: dbUser.plan,
      scoreDropAlerts: (dbUser as unknown as { scoreDropAlerts: boolean }).scoreDropAlerts ?? true,
      weeklyDigest: (dbUser as unknown as { weeklyDigest: boolean }).weeklyDigest ?? true,
      scanCompleteNotify: (dbUser as unknown as { scanCompleteNotify: boolean }).scanCompleteNotify ?? true,
      webhookUrl: (dbUser as unknown as { webhookUrl: string | null }).webhookUrl ?? null,
      projects: dbUser.projects,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/settings - Update user settings
export async function PATCH(request: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { scoreDropAlerts, weeklyDigest, scanCompleteNotify, name, webhookUrl } = body;

    // Validate webhook URL if provided
    if (webhookUrl !== undefined && webhookUrl !== null && webhookUrl !== '') {
      // Check if user has Pro Plus or Enterprise plan for webhooks
      if (dbUser.plan !== 'pro_plus' && dbUser.plan !== 'enterprise') {
        return NextResponse.json(
          { error: 'Webhooks require Pro Plus or Enterprise plan' },
          { status: 403 }
        );
      }

      // Validate URL format
      try {
        new URL(webhookUrl);
      } catch {
        return NextResponse.json(
          { error: 'Invalid webhook URL format' },
          { status: 400 }
        );
      }
    }

    // Update user settings
    const updatedUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        ...(typeof scoreDropAlerts === 'boolean' && { scoreDropAlerts }),
        ...(typeof weeklyDigest === 'boolean' && { weeklyDigest }),
        ...(typeof scanCompleteNotify === 'boolean' && { scanCompleteNotify }),
        ...(name !== undefined && { name }),
        ...(webhookUrl !== undefined && { webhookUrl: webhookUrl || null }),
      },
    });

    return NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      plan: updatedUser.plan,
      scoreDropAlerts: (updatedUser as unknown as { scoreDropAlerts: boolean }).scoreDropAlerts,
      weeklyDigest: (updatedUser as unknown as { weeklyDigest: boolean }).weeklyDigest,
      scanCompleteNotify: (updatedUser as unknown as { scanCompleteNotify: boolean }).scanCompleteNotify,
      webhookUrl: (updatedUser as unknown as { webhookUrl: string | null }).webhookUrl,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
