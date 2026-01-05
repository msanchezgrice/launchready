/**
 * PDF Export API
 * Generates a professionally formatted PDF report for a project scan
 * 
 * Note: Uses @react-pdf/renderer which requires Node.js runtime
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

// Dynamic import to handle serverless environments better
async function generatePDF(props: {
  projectName: string
  projectUrl: string
  score: number
  scannedAt: string
  phases: Array<{
    phaseName: string
    score: number
    maxScore: number
    findings: unknown
    recommendations: unknown
  }>
}) {
  try {
    // Dynamic imports for better serverless compatibility
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { ScanReportPDF } = await import('@/lib/pdf-template')
    
    const buffer = await renderToBuffer(
      <ScanReportPDF
        projectName={props.projectName}
        projectUrl={props.projectUrl}
        score={props.score}
        scannedAt={props.scannedAt}
        phases={props.phases as Parameters<typeof ScanReportPDF>[0]['phases']}
      />
    )
    
    return buffer
  } catch (error) {
    console.error('[PDF Export] renderToBuffer error:', error)
    throw error
  }
}

type Params = Promise<{ id: string }>

// Increase function timeout for PDF generation
export const maxDuration = 30 // 30 seconds

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  console.log('[PDF Export] Starting PDF generation...')
  
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    console.log(`[PDF Export] Fetching project ${id} for user ${userId}`)

    // Fetch project with latest scan
    const project = await prisma.project.findFirst({
      where: {
        id,
        user: { clerkId: userId },
      },
      include: {
        scans: {
          orderBy: { scannedAt: 'desc' },
          take: 1,
          include: {
            phases: true,
          },
        },
        user: {
          select: { plan: true },
        },
      },
    })

    if (!project) {
      console.log('[PDF Export] Project not found')
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.scans.length === 0) {
      console.log('[PDF Export] No scans available')
      return NextResponse.json({ error: 'No scans available' }, { status: 404 })
    }

    const latestScan = project.scans[0]
    console.log(`[PDF Export] Found scan with score ${latestScan.score}`)

    // Transform phases data - handle JSON values properly
    const phases = latestScan.phases.map((phase) => ({
      phaseName: phase.phaseName,
      score: phase.score,
      maxScore: phase.maxScore,
      findings: phase.findings,
      recommendations: phase.recommendations,
    }))

    console.log('[PDF Export] Generating PDF with react-pdf...')
    
    // Generate PDF with dynamic import
    const pdfBuffer = await generatePDF({
      projectName: project.name,
      projectUrl: project.url,
      score: latestScan.score,
      scannedAt: latestScan.scannedAt.toISOString(),
      phases,
    })

    console.log(`[PDF Export] PDF generated successfully, size: ${pdfBuffer.length} bytes`)

    // Generate filename
    const date = new Date().toISOString().split('T')[0]
    const sanitizedName = project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
    const filename = `launchready-${sanitizedName}-${date}.pdf`

    // Return PDF (convert Buffer to Uint8Array for NextResponse)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('[PDF Export] Error:', error)
    console.error('[PDF Export] Stack:', error instanceof Error ? error.stack : 'No stack')
    
    // Provide more detailed error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isMemoryError = errorMessage.includes('memory') || errorMessage.includes('heap')
    
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF', 
        details: errorMessage,
        hint: isMemoryError 
          ? 'PDF generation ran out of memory. Try again or contact support.' 
          : 'PDF generation failed. Please try again.'
      },
      { status: 500 }
    )
  }
}
