/**
 * Email Notifications via Resend
 * 
 * Environment Variables Required:
 * - RESEND_API_KEY: Your Resend API key
 * - EMAIL_FROM: Sender email (e.g., notifications@launchready.me)
 * 
 * Features:
 * - Scan complete notifications
 * - Score drop alerts (when score drops >10 points)
 * - Weekly digest summaries
 */

import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM = process.env.EMAIL_FROM || 'LaunchReady <notifications@launchready.me>';

export interface ScanResult {
  projectName: string;
  projectUrl: string;
  score: number;
  previousScore?: number;
  phases: Array<{
    name: string;
    score: number;
    maxScore: number;
    status: 'pass' | 'warn' | 'fail';
  }>;
  scanUrl: string;
}

export interface DigestData {
  userName: string;
  projects: Array<{
    name: string;
    url: string;
    currentScore: number;
    previousScore?: number;
    change: number;
    lastScanned: string;
  }>;
  dashboardUrl: string;
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return !!resend;
}

/**
 * Send scan complete notification
 */
export async function sendScanCompleteEmail(
  to: string,
  data: ScanResult
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.log('[Email] Resend not configured, skipping email');
    return { success: false, error: 'Email service not configured' };
  }

  const scoreColor = data.score >= 80 ? '#10b981' : data.score >= 60 ? '#f59e0b' : '#ef4444';
  const scoreEmoji = data.score >= 80 ? '🎉' : data.score >= 60 ? '⚠️' : '🔴';

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: `${scoreEmoji} Scan Complete: ${data.projectName} scored ${data.score}/100`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 12px; overflow: hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 30px; text-align: center; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);">
                      <h1 style="margin: 0; color: white; font-size: 24px;">🚀 LaunchReady.me</h1>
                      <p style="margin: 10px 0 0; color: rgba(255,255,255,0.8);">Scan Results</p>
                    </td>
                  </tr>
                  
                  <!-- Score Section -->
                  <tr>
                    <td style="padding: 40px 30px; text-align: center;">
                      <h2 style="margin: 0 0 10px; color: #e2e8f0; font-size: 18px;">${data.projectName}</h2>
                      <p style="margin: 0 0 20px; color: #94a3b8; font-size: 14px;">${data.projectUrl}</p>
                      
                      <div style="display: inline-block; padding: 30px 50px; background-color: #0f172a; border-radius: 12px; margin-bottom: 20px;">
                        <span style="font-size: 64px; font-weight: bold; color: ${scoreColor};">${data.score}</span>
                        <span style="font-size: 24px; color: #64748b;">/100</span>
                      </div>
                      
                      ${data.previousScore !== undefined ? `
                        <p style="margin: 0; color: ${data.score > data.previousScore ? '#10b981' : data.score < data.previousScore ? '#ef4444' : '#94a3b8'};">
                          ${data.score > data.previousScore ? '↑' : data.score < data.previousScore ? '↓' : '→'} 
                          ${Math.abs(data.score - data.previousScore)} points from last scan
                        </p>
                      ` : ''}
                    </td>
                  </tr>
                  
                  <!-- Phase Breakdown -->
                  <tr>
                    <td style="padding: 0 30px 30px;">
                      <h3 style="color: #e2e8f0; margin: 0 0 15px;">Phase Breakdown</h3>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        ${data.phases.map(phase => `
                          <tr>
                            <td style="padding: 10px; background-color: #0f172a; border-bottom: 1px solid #334155;">
                              <span style="color: ${phase.status === 'pass' ? '#10b981' : phase.status === 'warn' ? '#f59e0b' : '#ef4444'};">
                                ${phase.status === 'pass' ? '✅' : phase.status === 'warn' ? '⚠️' : '❌'}
                              </span>
                              <span style="color: #e2e8f0; margin-left: 10px;">${phase.name}</span>
                              <span style="float: right; color: #94a3b8;">${phase.score}/${phase.maxScore}</span>
                            </td>
                          </tr>
                        `).join('')}
                      </table>
                    </td>
                  </tr>
                  
                  <!-- CTA -->
                  <tr>
                    <td style="padding: 0 30px 40px; text-align: center;">
                      <a href="${data.scanUrl}" style="display: inline-block; padding: 14px 32px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        View Full Report →
                      </a>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 20px 30px; background-color: #0f172a; text-align: center;">
                      <p style="margin: 0; color: #64748b; font-size: 12px;">
                        LaunchReady.me • Ship with confidence
                      </p>
                      <p style="margin: 10px 0 0; color: #475569; font-size: 11px;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://launchready.me'}/settings" style="color: #6366f1;">Manage notification preferences</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log(`[Email] Scan complete email sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Failed to send scan complete email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send score drop alert
 */
export async function sendScoreDropAlert(
  to: string,
  data: {
    projectName: string;
    projectUrl: string;
    currentScore: number;
    previousScore: number;
    dropAmount: number;
    scanUrl: string;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.log('[Email] Resend not configured, skipping email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: `⚠️ Score Alert: ${data.projectName} dropped ${data.dropAmount} points`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 12px; overflow: hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 30px; text-align: center; background: linear-gradient(135deg, #dc2626 0%, #f97316 100%);">
                      <h1 style="margin: 0; color: white; font-size: 24px;">⚠️ Score Alert</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px; text-align: center;">
                      <h2 style="margin: 0 0 10px; color: #e2e8f0; font-size: 20px;">${data.projectName}</h2>
                      <p style="margin: 0 0 30px; color: #94a3b8;">${data.projectUrl}</p>
                      
                      <div style="display: flex; justify-content: center; align-items: center; gap: 20px;">
                        <div style="text-align: center;">
                          <p style="margin: 0; color: #64748b; font-size: 12px;">Previous</p>
                          <p style="margin: 5px 0 0; font-size: 32px; font-weight: bold; color: #94a3b8;">${data.previousScore}</p>
                        </div>
                        <div style="font-size: 24px; color: #ef4444;">→</div>
                        <div style="text-align: center;">
                          <p style="margin: 0; color: #64748b; font-size: 12px;">Current</p>
                          <p style="margin: 5px 0 0; font-size: 32px; font-weight: bold; color: #ef4444;">${data.currentScore}</p>
                        </div>
                      </div>
                      
                      <div style="margin-top: 30px; padding: 15px; background-color: #ef4444/10; border: 1px solid #ef4444/30; border-radius: 8px;">
                        <p style="margin: 0; color: #fca5a5;">
                          Your project score dropped by <strong>${data.dropAmount} points</strong>
                        </p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- CTA -->
                  <tr>
                    <td style="padding: 0 30px 40px; text-align: center;">
                      <a href="${data.scanUrl}" style="display: inline-block; padding: 14px 32px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        View Report & Fix Issues →
                      </a>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 20px 30px; background-color: #0f172a; text-align: center;">
                      <p style="margin: 0; color: #64748b; font-size: 12px;">
                        LaunchReady.me • Ship with confidence
                      </p>
                      <p style="margin: 10px 0 0; color: #475569; font-size: 11px;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://launchready.me'}/settings" style="color: #6366f1;">Manage notification preferences</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log(`[Email] Score drop alert sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Failed to send score drop alert:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send weekly digest email
 */
export async function sendWeeklyDigest(
  to: string,
  data: DigestData
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.log('[Email] Resend not configured, skipping email');
    return { success: false, error: 'Email service not configured' };
  }

  const totalProjects = data.projects.length;
  const avgScore = totalProjects > 0
    ? Math.round(data.projects.reduce((sum, p) => sum + p.currentScore, 0) / totalProjects)
    : 0;
  const improvedCount = data.projects.filter(p => p.change > 0).length;
  const declinedCount = data.projects.filter(p => p.change < 0).length;

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: `📊 Weekly Report: ${totalProjects} projects, avg score ${avgScore}/100`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 12px; overflow: hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 30px; text-align: center; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);">
                      <h1 style="margin: 0; color: white; font-size: 24px;">📊 Weekly Report</h1>
                      <p style="margin: 10px 0 0; color: rgba(255,255,255,0.8);">Hi ${data.userName || 'there'}!</p>
                    </td>
                  </tr>
                  
                  <!-- Summary Stats -->
                  <tr>
                    <td style="padding: 30px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td width="33%" style="text-align: center; padding: 15px; background-color: #0f172a; border-radius: 8px;">
                            <p style="margin: 0; color: #64748b; font-size: 12px;">Projects</p>
                            <p style="margin: 5px 0 0; font-size: 28px; font-weight: bold; color: #e2e8f0;">${totalProjects}</p>
                          </td>
                          <td width="33%" style="text-align: center; padding: 15px; background-color: #0f172a; border-radius: 8px; margin: 0 10px;">
                            <p style="margin: 0; color: #64748b; font-size: 12px;">Avg Score</p>
                            <p style="margin: 5px 0 0; font-size: 28px; font-weight: bold; color: ${avgScore >= 80 ? '#10b981' : avgScore >= 60 ? '#f59e0b' : '#ef4444'};">${avgScore}</p>
                          </td>
                          <td width="33%" style="text-align: center; padding: 15px; background-color: #0f172a; border-radius: 8px;">
                            <p style="margin: 0; color: #64748b; font-size: 12px;">Changes</p>
                            <p style="margin: 5px 0 0; font-size: 14px; color: #e2e8f0;">
                              <span style="color: #10b981;">↑${improvedCount}</span> / 
                              <span style="color: #ef4444;">↓${declinedCount}</span>
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Project List -->
                  <tr>
                    <td style="padding: 0 30px 30px;">
                      <h3 style="color: #e2e8f0; margin: 0 0 15px;">Your Projects</h3>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        ${data.projects.map(project => `
                          <tr>
                            <td style="padding: 15px; background-color: #0f172a; border-bottom: 1px solid #334155;">
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td>
                                    <p style="margin: 0; color: #e2e8f0; font-weight: 500;">${project.name}</p>
                                    <p style="margin: 5px 0 0; color: #64748b; font-size: 12px;">${project.url}</p>
                                  </td>
                                  <td style="text-align: right;">
                                    <p style="margin: 0; font-size: 20px; font-weight: bold; color: ${project.currentScore >= 80 ? '#10b981' : project.currentScore >= 60 ? '#f59e0b' : '#ef4444'};">
                                      ${project.currentScore}
                                    </p>
                                    ${project.change !== 0 ? `
                                      <p style="margin: 5px 0 0; font-size: 12px; color: ${project.change > 0 ? '#10b981' : '#ef4444'};">
                                        ${project.change > 0 ? '↑' : '↓'} ${Math.abs(project.change)}
                                      </p>
                                    ` : ''}
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        `).join('')}
                      </table>
                    </td>
                  </tr>
                  
                  <!-- CTA -->
                  <tr>
                    <td style="padding: 0 30px 40px; text-align: center;">
                      <a href="${data.dashboardUrl}" style="display: inline-block; padding: 14px 32px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        View Dashboard →
                      </a>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 20px 30px; background-color: #0f172a; text-align: center;">
                      <p style="margin: 0; color: #64748b; font-size: 12px;">
                        LaunchReady.me • Ship with confidence
                      </p>
                      <p style="margin: 10px 0 0; color: #475569; font-size: 11px;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://launchready.me'}/settings" style="color: #6366f1;">Manage notification preferences</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log(`[Email] Weekly digest sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Failed to send weekly digest:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
