/**
 * Webhook Notifications
 * Sends scan notifications to Slack, Discord, or custom webhook URLs
 */

interface ScanCompletePayload {
  projectName: string
  projectUrl: string
  score: number
  previousScore?: number
  change?: number
  scanUrl: string
  trigger: string
  timestamp: string
  phases: Array<{
    name: string
    score: number
    maxScore: number
    status: 'pass' | 'warning' | 'fail'
  }>
}

interface WebhookResult {
  success: boolean
  error?: string
}

/**
 * Detect webhook type from URL
 */
function getWebhookType(url: string): 'slack' | 'discord' | 'custom' {
  if (url.includes('hooks.slack.com')) return 'slack'
  if (url.includes('discord.com/api/webhooks')) return 'discord'
  return 'custom'
}

/**
 * Format payload for Slack webhook
 */
function formatSlackPayload(data: ScanCompletePayload) {
  const scoreEmoji = data.score >= 80 ? '🟢' : data.score >= 60 ? '🟡' : '🔴'
  const changeText = data.change !== undefined 
    ? ` (${data.change >= 0 ? '+' : ''}${data.change})`
    : ''
  
  const phaseBlocks = data.phases.map(phase => {
    const emoji = phase.status === 'pass' ? '✅' : phase.status === 'warning' ? '⚠️' : '❌'
    return `${emoji} ${phase.name}: ${phase.score}/${phase.maxScore}`
  }).join('\n')

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${scoreEmoji} Scan Complete: ${data.projectName}`,
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Score:*\n${data.score}/100${changeText}`
          },
          {
            type: 'mrkdwn',
            text: `*Trigger:*\n${data.trigger}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Phase Breakdown:*\n${phaseBlocks}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details',
              emoji: true
            },
            url: data.scanUrl,
            style: 'primary'
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Scanned at ${new Date(data.timestamp).toLocaleString()}`
          }
        ]
      }
    ]
  }
}

/**
 * Format payload for Discord webhook
 */
function formatDiscordPayload(data: ScanCompletePayload) {
  const scoreColor = data.score >= 80 ? 0x10B981 : data.score >= 60 ? 0xF59E0B : 0xEF4444
  const changeText = data.change !== undefined 
    ? ` (${data.change >= 0 ? '+' : ''}${data.change})`
    : ''
  
  const phaseText = data.phases.map(phase => {
    const emoji = phase.status === 'pass' ? '✅' : phase.status === 'warning' ? '⚠️' : '❌'
    return `${emoji} **${phase.name}**: ${phase.score}/${phase.maxScore}`
  }).join('\n')

  return {
    embeds: [
      {
        title: `Scan Complete: ${data.projectName}`,
        url: data.scanUrl,
        color: scoreColor,
        fields: [
          {
            name: 'Score',
            value: `**${data.score}/100**${changeText}`,
            inline: true
          },
          {
            name: 'Trigger',
            value: data.trigger,
            inline: true
          },
          {
            name: 'URL',
            value: data.projectUrl,
            inline: false
          },
          {
            name: 'Phase Breakdown',
            value: phaseText,
            inline: false
          }
        ],
        timestamp: data.timestamp,
        footer: {
          text: 'LaunchReady.me'
        }
      }
    ]
  }
}

/**
 * Format payload for custom webhook (JSON)
 */
function formatCustomPayload(data: ScanCompletePayload) {
  return {
    event: 'scan.complete',
    ...data
  }
}

/**
 * Send webhook notification
 */
export async function sendWebhookNotification(
  webhookUrl: string,
  data: ScanCompletePayload
): Promise<WebhookResult> {
  if (!webhookUrl) {
    return { success: false, error: 'No webhook URL configured' }
  }

  try {
    const webhookType = getWebhookType(webhookUrl)
    let payload: object

    switch (webhookType) {
      case 'slack':
        payload = formatSlackPayload(data)
        break
      case 'discord':
        payload = formatDiscordPayload(data)
        break
      default:
        payload = formatCustomPayload(data)
    }

    console.log(`[Webhook] Sending ${webhookType} notification to ${webhookUrl.substring(0, 50)}...`)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Webhook] Failed: ${response.status} - ${errorText}`)
      return { 
        success: false, 
        error: `Webhook returned ${response.status}: ${errorText.substring(0, 100)}` 
      }
    }

    console.log(`[Webhook] Successfully sent ${webhookType} notification`)
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Webhook] Error:`, error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Send score drop alert via webhook
 */
export async function sendScoreDropWebhook(
  webhookUrl: string,
  data: {
    projectName: string
    projectUrl: string
    previousScore: number
    currentScore: number
    dropAmount: number
    scanUrl: string
  }
): Promise<WebhookResult> {
  if (!webhookUrl) {
    return { success: false, error: 'No webhook URL configured' }
  }

  try {
    const webhookType = getWebhookType(webhookUrl)
    let payload: object

    if (webhookType === 'slack') {
      payload = {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `🚨 Score Drop Alert: ${data.projectName}`,
              emoji: true
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Your project score dropped from *${data.previousScore}* to *${data.currentScore}* (-${data.dropAmount} points)`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'View Details',
                  emoji: true
                },
                url: data.scanUrl,
                style: 'danger'
              }
            ]
          }
        ]
      }
    } else if (webhookType === 'discord') {
      payload = {
        embeds: [
          {
            title: `🚨 Score Drop Alert: ${data.projectName}`,
            url: data.scanUrl,
            color: 0xEF4444,
            description: `Score dropped from **${data.previousScore}** to **${data.currentScore}** (-${data.dropAmount} points)`,
            fields: [
              { name: 'URL', value: data.projectUrl, inline: false }
            ],
            footer: { text: 'LaunchReady.me' }
          }
        ]
      }
    } else {
      payload = {
        event: 'score.drop',
        ...data
      }
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      return { success: false, error: `Webhook returned ${response.status}` }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
