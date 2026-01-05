/**
 * PDF Export API
 * Generates a professionally formatted PDF report for a project scan
 * 
 * Uses jsPDF for reliable serverless generation (no native dependencies)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { jsPDF } from 'jspdf'

type Params = Promise<{ id: string }>

// Helper functions
function getScoreColor(score: number): [number, number, number] {
  if (score >= 80) return [16, 185, 129] // Green
  if (score >= 60) return [245, 158, 11] // Yellow
  return [239, 68, 68] // Red
}

function getGrade(score: number): { grade: string; label: string } {
  if (score >= 90) return { grade: 'A', label: 'Excellent' }
  if (score >= 80) return { grade: 'B', label: 'Good' }
  if (score >= 70) return { grade: 'C', label: 'Fair' }
  if (score >= 60) return { grade: 'D', label: 'Needs Work' }
  return { grade: 'F', label: 'Critical' }
}

function parseArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return []
    }
  }
  return []
}

interface Finding {
  type: 'success' | 'warning' | 'error'
  message: string
}

interface Recommendation {
  title: string
  description?: string
  priority?: 'high' | 'medium' | 'low'
  actionable?: string
}

interface Phase {
  phaseName: string
  score: number
  maxScore: number
  findings: unknown
  recommendations: unknown
}

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  console.log('[PDF Export] Starting PDF generation with jsPDF...')
  
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

    // Transform phases data
    const phases: Phase[] = latestScan.phases.map((phase) => ({
      phaseName: phase.phaseName,
      score: phase.score,
      maxScore: phase.maxScore,
      findings: phase.findings,
      recommendations: phase.recommendations,
    }))

    // Create PDF
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    const contentWidth = pageWidth - (margin * 2)
    let y = margin

    // Colors
    const primaryColor: [number, number, number] = [79, 70, 229] // Indigo
    const darkColor: [number, number, number] = [30, 41, 59]
    const mediumColor: [number, number, number] = [100, 116, 139]
    const lightColor: [number, number, number] = [148, 163, 184]

    // Header
    doc.setFillColor(...primaryColor)
    doc.rect(margin, y, 8, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...darkColor)
    doc.text('LaunchReady', margin + 12, y + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...mediumColor)
    const scanDate = new Date(latestScan.scannedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    doc.text('Launch Readiness Report', pageWidth - margin - 55, y + 3)
    doc.text(scanDate, pageWidth - margin - 40, y + 8)

    // Header line
    y += 15
    doc.setDrawColor(...primaryColor)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)

    // Project Name
    y += 15
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(...darkColor)
    doc.text(project.name, margin, y)

    // Project URL
    y += 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...primaryColor)
    doc.text(project.url, margin, y)

    // Score Card
    y += 15
    const score = latestScan.score
    const scoreColor = getScoreColor(score)
    const grade = getGrade(score)

    // Score card background
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(margin, y, contentWidth, 40, 3, 3, 'FD')

    // Score circle
    doc.setFillColor(...scoreColor)
    doc.circle(margin + 25, y + 20, 15, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(255, 255, 255)
    doc.text(score.toString(), margin + 25, y + 22, { align: 'center' })
    doc.setFontSize(8)
    doc.text('/100', margin + 25, y + 28, { align: 'center' })

    // Score details
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...darkColor)
    doc.text('Overall Readiness Score', margin + 50, y + 12)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...mediumColor)
    const description = score >= 80
      ? 'Your project is well-prepared for launch!'
      : score >= 60
      ? 'Some improvements needed before launch.'
      : 'Critical issues found. Address high-priority items.'
    doc.text(description, margin + 50, y + 20)

    // Grade badge
    doc.setFillColor(...scoreColor)
    doc.roundedRect(margin + 50, y + 25, 50, 8, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text(`Grade ${grade.grade} - ${grade.label}`, margin + 75, y + 30, { align: 'center' })

    // Stats summary
    y += 50
    const passedPhases = phases.filter(p => (p.score / p.maxScore) >= 0.7).length
    const warningPhases = phases.filter(p => {
      const pct = p.score / p.maxScore
      return pct >= 0.5 && pct < 0.7
    }).length
    const failedPhases = phases.filter(p => (p.score / p.maxScore) < 0.5).length

    const boxWidth = (contentWidth - 15) / 4
    const stats = [
      { label: 'Passed', value: passedPhases, color: [16, 185, 129] as [number, number, number] },
      { label: 'Warnings', value: warningPhases, color: [245, 158, 11] as [number, number, number] },
      { label: 'Failed', value: failedPhases, color: [239, 68, 68] as [number, number, number] },
      { label: 'Categories', value: phases.length, color: darkColor },
    ]

    stats.forEach((stat, i) => {
      const boxX = margin + (i * (boxWidth + 5))
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(boxX, y, boxWidth, 25, 2, 2, 'FD')
      
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(...stat.color)
      doc.text(stat.value.toString(), boxX + boxWidth / 2, y + 12, { align: 'center' })
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...lightColor)
      doc.text(stat.label.toUpperCase(), boxX + boxWidth / 2, y + 20, { align: 'center' })
    })

    // Category Breakdown
    y += 35
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...darkColor)
    doc.text('Category Breakdown', margin, y)

    y += 8
    phases.forEach((phase) => {
      // Check if we need a new page
      if (y > 260) {
        doc.addPage()
        y = margin
      }

      const phasePercentage = Math.round((phase.score / phase.maxScore) * 100)
      const phaseColor = getScoreColor(phasePercentage)

      // Phase card
      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(margin, y, contentWidth, 25, 2, 2, 'FD')

      // Phase name
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...darkColor)
      doc.text(phase.phaseName, margin + 5, y + 8)

      // Phase score
      doc.setTextColor(...phaseColor)
      const scoreText = `${phase.score}/${phase.maxScore} (${phasePercentage}%)`
      doc.text(scoreText, pageWidth - margin - 5 - doc.getTextWidth(scoreText), y + 8)

      // Progress bar
      const barY = y + 12
      const barWidth = contentWidth - 10
      doc.setFillColor(226, 232, 240)
      doc.roundedRect(margin + 5, barY, barWidth, 4, 1, 1, 'F')
      doc.setFillColor(...phaseColor)
      doc.roundedRect(margin + 5, barY, barWidth * (phasePercentage / 100), 4, 1, 1, 'F')

      // Key findings (max 2)
      const findings = parseArray(phase.findings) as Finding[]
      if (findings.length > 0) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...mediumColor)
        findings.slice(0, 2).forEach((finding, i) => {
          const truncated = finding.message.length > 80 
            ? finding.message.substring(0, 80) + '...' 
            : finding.message
          doc.text(`• ${truncated}`, margin + 7, y + 19 + (i * 4))
        })
      }

      y += 30
    })

    // Recommendations page
    doc.addPage()
    y = margin

    // Header for recommendations page
    doc.setFillColor(...primaryColor)
    doc.rect(margin, y, 8, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...darkColor)
    doc.text('LaunchReady', margin + 12, y + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...mediumColor)
    doc.text('Recommendations', pageWidth - margin - 35, y + 3)
    doc.text(project.name, pageWidth - margin - 40, y + 8)

    y += 15
    doc.setDrawColor(...primaryColor)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)

    y += 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...darkColor)
    doc.text('Actionable Recommendations', margin, y)

    y += 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...mediumColor)
    doc.text('Address these items to improve your launch readiness score.', margin, y)

    y += 10
    phases.forEach((phase) => {
      const recommendations = parseArray(phase.recommendations) as Recommendation[]
      if (recommendations.length === 0) return

      // Check if we need a new page
      if (y > 240) {
        doc.addPage()
        y = margin
      }

      // Phase header
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...darkColor)
      doc.text(phase.phaseName, margin, y)
      y += 6

      recommendations.forEach((rec) => {
        if (y > 260) {
          doc.addPage()
          y = margin
        }

        const priorityColor: [number, number, number] = rec.priority === 'high' 
          ? [239, 68, 68] 
          : rec.priority === 'medium' 
          ? [245, 158, 11] 
          : [16, 185, 129]

        // Recommendation card
        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(...priorityColor)
        doc.setLineWidth(0.5)
        doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD')
        doc.setLineWidth(1)
        doc.line(margin, y, margin, y + 22)

        // Priority badge
        if (rec.priority) {
          doc.setFillColor(...priorityColor)
          doc.roundedRect(margin + 5, y + 3, 25, 5, 1, 1, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(6)
          doc.setTextColor(255, 255, 255)
          doc.text(rec.priority.toUpperCase(), margin + 17.5, y + 6.5, { align: 'center' })
        }

        // Title
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...darkColor)
        doc.text(rec.title, margin + (rec.priority ? 35 : 5), y + 7)

        // Description
        if (rec.description) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(...mediumColor)
          const truncatedDesc = rec.description.length > 100 
            ? rec.description.substring(0, 100) + '...' 
            : rec.description
          doc.text(truncatedDesc, margin + 5, y + 14)
        }

        // Actionable
        if (rec.actionable) {
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(7)
          doc.setTextColor(...mediumColor)
          const truncatedAction = rec.actionable.length > 90 
            ? rec.actionable.substring(0, 90) + '...' 
            : rec.actionable
          doc.text(`→ ${truncatedAction}`, margin + 5, y + 19)
        }

        y += 26
      })

      y += 5
    })

    // Footer on all pages
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...lightColor)
      doc.text('Generated by LaunchReady.me', margin, 285)
      doc.setTextColor(...primaryColor)
      doc.text('launchready.me', pageWidth / 2, 285, { align: 'center' })
      doc.setTextColor(...lightColor)
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, 285, { align: 'right' })
    }

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    console.log(`[PDF Export] PDF generated successfully, size: ${pdfBuffer.length} bytes`)

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
    console.error('[PDF Export] Stack:', error instanceof Error ? error.stack : 'No stack')
    
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF', 
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
