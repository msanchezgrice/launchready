import { NextRequest, NextResponse } from 'next/server';
import { scanProject } from '@/lib/scanner';

// Allow up to 60 seconds for scanning (Vercel Pro/Hobby limit)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Run the scan
    const result = await scanProject(url);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Scan error:', error);
    return NextResponse.json(
      { error: 'Failed to scan project' },
      { status: 500 }
    );
  }
}
