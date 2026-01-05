import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
  try {
    // Get real scan count from database
    const [scanCount, projectCount] = await Promise.all([
      prisma.scan.count(),
      prisma.project.count(),
    ]);

    return NextResponse.json({
      scans: scanCount,
      projects: projectCount,
    });
  } catch (error) {
    console.error('Stats API error:', error);
    // Return fallback if database fails
    return NextResponse.json({
      scans: 0,
      projects: 0,
    });
  }
}
