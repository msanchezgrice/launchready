/**
 * PDF Export API
 * Generates a professionally formatted PDF report for a project scan
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { renderToBuffer } from '@react-pdf/renderer'
import { ScanReportPDF } from '@/lib/pdf-template'
import React from 'react'

type Params = Promise<{ id: string }>

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

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
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if user has Pro plan for PDF export
    // For now, allow all users but can restrict to Pro later
    // if (project.user.plan === 'free') {
    //   return NextResponse.json({ error: 'PDF export requires Pro plan', upgrade: true }, { status: 403 })
    // }

    if (project.scans.length === 0) {
      return NextResponse.json({ error: 'No scans available' }, { status: 404 })
    }

    const latestScan = project.scans[0]

    // Transform phases data
    const phases = latestScan.phases.map((phase) => ({
      phaseName: phase.phaseName,
      score: phase.score,
      maxScore: phase.maxScore,
      findings: phase.findings,
      recommendations: phase.recommendations,
    }))

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      React.createElement(ScanReportPDF, {
        projectName: project.name,
        projectUrl: project.url,
        score: latestScan.score,
        scannedAt: latestScan.scannedAt.toISOString(),
        phases,
      })
    )

    // Generate filename
    const date = new Date().toISOString().split('T')[0]
    const sanitizedName = project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
    const filename = `launchready-${sanitizedName}-${date}.pdf`

    // Return PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('[PDF Export] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
