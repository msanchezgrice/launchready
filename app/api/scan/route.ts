import { NextRequest, NextResponse } from 'next/server';
import { scanProject } from '@/lib/scanner';

// Allow up to 300 seconds for scanning (Vercel Pro maximum)
export const maxDuration = 300;

/**
 * Normalize a URL input to a proper https:// URL
 * Handles: domain.com, www.domain.com, http://domain.com, https://domain.com
 */
function normalizeUrl(input: string): string {
  let url = input.trim();
  
  // Remove any trailing slashes for consistency
  url = url.replace(/\/+$/, '');
  
  // If no protocol, add https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  // Upgrade http to https
  if (url.startsWith('http://')) {
    url = url.replace('http://', 'https://');
  }
  
  return url;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Normalize the URL (add https://, handle www, etc.)
    url = normalizeUrl(url);

    // Validate URL format after normalization
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format. Please enter a valid domain like example.com' },
        { status: 400 }
      );
    }

    console.log(`[API] Scanning normalized URL: ${url}`);

    // Run the scan
    const result = await scanProject(url);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Scan error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to scan project: ${errorMessage}` },
      { status: 500 }
    );
  }
}
