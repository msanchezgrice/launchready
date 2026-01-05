/**
 * LaunchReady PDF Report Template
 * Professional, well-formatted PDF export for scan results
 */

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// Register fonts for better typography
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2', fontWeight: 500 },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff2', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2', fontWeight: 700 },
  ],
})

// Color palette
const colors = {
  primary: '#4f46e5', // Indigo
  secondary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  dark: '#1e293b',
  medium: '#64748b',
  light: '#94a3b8',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
}

// Styles
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 10,
    padding: 40,
    backgroundColor: colors.white,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 28,
    height: 28,
    backgroundColor: colors.primary,
    borderRadius: 6,
    marginRight: 10,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.dark,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  reportTitle: {
    fontSize: 11,
    color: colors.medium,
    marginBottom: 2,
  },
  reportDate: {
    fontSize: 10,
    color: colors.light,
  },
  // Project Info
  projectSection: {
    marginBottom: 25,
  },
  projectName: {
    fontSize: 24,
    fontWeight: 700,
    color: colors.dark,
    marginBottom: 6,
  },
  projectUrl: {
    fontSize: 11,
    color: colors.primary,
    marginBottom: 4,
  },
  projectMeta: {
    fontSize: 9,
    color: colors.light,
  },
  // Score Card
  scoreCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 24,
    marginBottom: 25,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  scoreCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 24,
  },
  scoreNumber: {
    fontSize: 32,
    fontWeight: 700,
    color: colors.white,
  },
  scoreMax: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  scoreDetails: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: colors.dark,
    marginBottom: 6,
  },
  scoreDescription: {
    fontSize: 10,
    color: colors.medium,
    lineHeight: 1.5,
  },
  // Grade Badge
  gradeBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  gradeText: {
    fontSize: 11,
    fontWeight: 600,
    color: colors.white,
  },
  // Phases Section
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: colors.dark,
    marginBottom: 15,
    marginTop: 10,
  },
  phaseCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  phaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  phaseName: {
    fontSize: 12,
    fontWeight: 600,
    color: colors.dark,
  },
  phaseScore: {
    fontSize: 11,
    fontWeight: 600,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginBottom: 10,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  // Findings
  findingsContainer: {
    marginTop: 8,
  },
  findingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingLeft: 4,
  },
  findingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
    marginTop: 4,
  },
  findingText: {
    fontSize: 9,
    color: colors.medium,
    flex: 1,
    lineHeight: 1.4,
  },
  // Recommendations
  recommendationsSection: {
    marginTop: 20,
  },
  recommendationCard: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  recommendationTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: colors.dark,
    marginBottom: 4,
  },
  recommendationDesc: {
    fontSize: 9,
    color: colors.medium,
    lineHeight: 1.4,
  },
  priorityBadge: {
    fontSize: 8,
    fontWeight: 600,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    fontSize: 8,
    color: colors.light,
  },
  footerLink: {
    fontSize: 8,
    color: colors.primary,
  },
  pageNumber: {
    fontSize: 8,
    color: colors.light,
  },
  // Summary Stats
  statsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginRight: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statBoxLast: {
    marginRight: 0,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.dark,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 8,
    color: colors.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
})

// Helper functions
function getScoreColor(score: number): string {
  if (score >= 80) return colors.success
  if (score >= 60) return colors.warning
  return colors.error
}

function getGrade(score: number): { grade: string; color: string; label: string } {
  if (score >= 90) return { grade: 'A', color: colors.success, label: 'Excellent' }
  if (score >= 80) return { grade: 'B', color: '#22c55e', label: 'Good' }
  if (score >= 70) return { grade: 'C', color: colors.warning, label: 'Fair' }
  if (score >= 60) return { grade: 'D', color: '#f97316', label: 'Needs Work' }
  return { grade: 'F', color: colors.error, label: 'Critical' }
}

function getPriorityColor(priority: string): string {
  switch (priority?.toLowerCase()) {
    case 'high': return colors.error
    case 'medium': return colors.warning
    case 'low': return colors.success
    default: return colors.medium
  }
}

function getFindingColor(type: string): string {
  switch (type) {
    case 'success': return colors.success
    case 'warning': return colors.warning
    case 'error': return colors.error
    default: return colors.medium
  }
}

// Types
interface Finding {
  type: 'success' | 'warning' | 'error'
  message: string
  details?: string
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
  findings: Finding[] | string
  recommendations?: Recommendation[] | string | null
}

interface ScanReportProps {
  projectName: string
  projectUrl: string
  score: number
  scannedAt: string
  phases: Phase[]
}

// Main PDF Document Component
export function ScanReportPDF({
  projectName,
  projectUrl,
  score,
  scannedAt,
  phases,
}: ScanReportProps) {
  const grade = getGrade(score)
  const scoreColor = getScoreColor(score)
  const scanDate = new Date(scannedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Parse findings/recommendations if they're strings
  const parseArray = (data: unknown): unknown[] => {
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

  // Calculate stats
  const passedPhases = phases.filter(p => (p.score / p.maxScore) >= 0.7).length
  const warningPhases = phases.filter(p => {
    const pct = p.score / p.maxScore
    return pct >= 0.5 && pct < 0.7
  }).length
  const failedPhases = phases.filter(p => (p.score / p.maxScore) < 0.5).length

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <View style={styles.logoIcon} />
            <Text style={styles.logoText}>LaunchReady</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.reportTitle}>Launch Readiness Report</Text>
            <Text style={styles.reportDate}>{scanDate}</Text>
          </View>
        </View>

        {/* Project Info */}
        <View style={styles.projectSection}>
          <Text style={styles.projectName}>{projectName}</Text>
          <Text style={styles.projectUrl}>{projectUrl}</Text>
        </View>

        {/* Score Card */}
        <View style={styles.scoreCard}>
          <View style={[styles.scoreCircle, { backgroundColor: scoreColor }]}>
            <Text style={styles.scoreNumber}>{score}</Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>
          <View style={styles.scoreDetails}>
            <Text style={styles.scoreLabel}>Overall Readiness Score</Text>
            <Text style={styles.scoreDescription}>
              {score >= 80
                ? 'Your project is well-prepared for launch. Keep up the great work!'
                : score >= 60
                ? 'Your project needs some improvements before launch. Review the recommendations below.'
                : 'Critical issues found. Address the high-priority items before launching.'}
            </Text>
            <View style={[styles.gradeBadge, { backgroundColor: grade.color }]}>
              <Text style={styles.gradeText}>Grade {grade.grade} - {grade.label}</Text>
            </View>
          </View>
        </View>

        {/* Summary Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.success }]}>{passedPhases}</Text>
            <Text style={styles.statLabel}>Passed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.warning }]}>{warningPhases}</Text>
            <Text style={styles.statLabel}>Warnings</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.error }]}>{failedPhases}</Text>
            <Text style={styles.statLabel}>Failed</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxLast]}>
            <Text style={styles.statValue}>{phases.length}</Text>
            <Text style={styles.statLabel}>Categories</Text>
          </View>
        </View>

        {/* Phase Breakdown */}
        <Text style={styles.sectionTitle}>Category Breakdown</Text>
        {phases.map((phase, index) => {
          const phasePercentage = Math.round((phase.score / phase.maxScore) * 100)
          const phaseColor = getScoreColor(phasePercentage)
          const findings = parseArray(phase.findings) as Finding[]

          return (
            <View key={index} style={styles.phaseCard}>
              <View style={styles.phaseHeader}>
                <Text style={styles.phaseName}>{phase.phaseName}</Text>
                <Text style={[styles.phaseScore, { color: phaseColor }]}>
                  {phase.score}/{phase.maxScore} ({phasePercentage}%)
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${phasePercentage}%`, backgroundColor: phaseColor },
                  ]}
                />
              </View>
              {findings.length > 0 && (
                <View style={styles.findingsContainer}>
                  {findings.slice(0, 3).map((finding, fIndex) => (
                    <View key={fIndex} style={styles.findingItem}>
                      <View
                        style={[
                          styles.findingDot,
                          { backgroundColor: getFindingColor(finding.type) },
                        ]}
                      />
                      <Text style={styles.findingText}>{finding.message}</Text>
                    </View>
                  ))}
                  {findings.length > 3 && (
                    <Text style={[styles.findingText, { paddingLeft: 14, fontStyle: 'italic' }]}>
                      +{findings.length - 3} more findings
                    </Text>
                  )}
                </View>
              )}
            </View>
          )
        })}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generated by LaunchReady.me
          </Text>
          <Text style={styles.footerLink}>launchready.me</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>

      {/* Recommendations Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <View style={styles.logoIcon} />
            <Text style={styles.logoText}>LaunchReady</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.reportTitle}>Recommendations</Text>
            <Text style={styles.reportDate}>{projectName}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Actionable Recommendations</Text>
        <Text style={[styles.scoreDescription, { marginBottom: 15 }]}>
          Address these items to improve your launch readiness score.
        </Text>

        {phases.map((phase, pIndex) => {
          const recommendations = parseArray(phase.recommendations) as Recommendation[]
          if (recommendations.length === 0) return null

          return (
            <View key={pIndex} style={styles.recommendationsSection}>
              <Text style={[styles.phaseName, { marginBottom: 10 }]}>{phase.phaseName}</Text>
              {recommendations.map((rec, rIndex) => (
                <View
                  key={rIndex}
                  style={[
                    styles.recommendationCard,
                    { borderLeftColor: getPriorityColor(rec.priority || 'medium') },
                  ]}
                >
                  {rec.priority && (
                    <Text
                      style={[
                        styles.priorityBadge,
                        { backgroundColor: getPriorityColor(rec.priority), color: colors.white },
                      ]}
                    >
                      {rec.priority.toUpperCase()}
                    </Text>
                  )}
                  <Text style={styles.recommendationTitle}>{rec.title}</Text>
                  {rec.description && (
                    <Text style={styles.recommendationDesc}>{rec.description}</Text>
                  )}
                  {rec.actionable && (
                    <Text style={[styles.recommendationDesc, { marginTop: 4, fontStyle: 'italic' }]}>
                      → {rec.actionable}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )
        })}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generated by LaunchReady.me
          </Text>
          <Text style={styles.footerLink}>launchready.me</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}
