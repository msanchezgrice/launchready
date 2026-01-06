/**
 * Input Validation Utilities
 * Client and server-side validation for user inputs
 */

// URL validation
export function isValidUrl(input: string): boolean {
  if (!input || typeof input !== 'string') return false
  
  // Try to create a URL object
  try {
    const url = new URL(input.trim())
    // Must be http or https
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    // If it fails, try adding https://
    try {
      const url = new URL(`https://${input.trim()}`)
      return true
    } catch {
      return false
    }
  }
}

// Normalize URL (add https if missing)
export function normalizeUrl(input: string): string {
  if (!input) return ''
  
  const trimmed = input.trim()
  
  // Already has protocol
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  
  // Add https by default
  return `https://${trimmed}`
}

// GitHub repository validation
export function isValidGitHubRepo(input: string): boolean {
  if (!input || typeof input !== 'string') return false
  
  const trimmed = input.trim()
  
  // Check for full URL format
  const urlPattern = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/
  if (urlPattern.test(trimmed)) return true
  
  // Check for owner/repo format
  const shortPattern = /^[\w.-]+\/[\w.-]+$/
  return shortPattern.test(trimmed)
}

// Normalize GitHub repo to owner/repo format
export function normalizeGitHubRepo(input: string): string {
  if (!input) return ''
  
  const trimmed = input.trim()
  
  // Extract from URL
  const urlMatch = trimmed.match(/github\.com\/([\w.-]+\/[\w.-]+)\/?$/)
  if (urlMatch) {
    return urlMatch[1]
  }
  
  // Already in owner/repo format
  if (/^[\w.-]+\/[\w.-]+$/.test(trimmed)) {
    return trimmed
  }
  
  return trimmed
}

// Email validation
export function isValidEmail(input: string): boolean {
  if (!input || typeof input !== 'string') return false
  
  // Basic email pattern (not exhaustive but covers most cases)
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return pattern.test(input.trim())
}

// Webhook URL validation (Slack, Discord, or custom)
export function isValidWebhookUrl(input: string): boolean {
  if (!input || typeof input !== 'string') return false
  
  const trimmed = input.trim()
  
  // Must be a valid URL
  if (!isValidUrl(trimmed)) return false
  
  // Check for common webhook patterns
  const validPatterns = [
    /^https:\/\/hooks\.slack\.com\//,
    /^https:\/\/discord\.com\/api\/webhooks\//,
    /^https:\/\/discordapp\.com\/api\/webhooks\//,
    /^https?:\/\//, // Allow any HTTPS URL for custom webhooks
  ]
  
  return validPatterns.some(pattern => pattern.test(trimmed))
}

// Project name validation
export function isValidProjectName(input: string): {
  valid: boolean
  error?: string
} {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'Project name is required' }
  }
  
  const trimmed = input.trim()
  
  if (trimmed.length < 2) {
    return { valid: false, error: 'Project name must be at least 2 characters' }
  }
  
  if (trimmed.length > 100) {
    return { valid: false, error: 'Project name must be 100 characters or less' }
  }
  
  return { valid: true }
}

// Validation error messages
export const VALIDATION_ERRORS = {
  URL_REQUIRED: 'Please enter a URL',
  URL_INVALID: 'Please enter a valid URL (e.g., https://example.com)',
  REPO_INVALID: 'Please enter a valid GitHub repository (e.g., owner/repo)',
  EMAIL_INVALID: 'Please enter a valid email address',
  WEBHOOK_INVALID: 'Please enter a valid webhook URL',
  NAME_REQUIRED: 'Project name is required',
  NAME_TOO_SHORT: 'Project name must be at least 2 characters',
  NAME_TOO_LONG: 'Project name must be 100 characters or less',
}

// Form field validation helper
export function validateField(
  value: string,
  type: 'url' | 'github' | 'email' | 'webhook' | 'name'
): { valid: boolean; error?: string } {
  switch (type) {
    case 'url':
      if (!value.trim()) return { valid: false, error: VALIDATION_ERRORS.URL_REQUIRED }
      if (!isValidUrl(value)) return { valid: false, error: VALIDATION_ERRORS.URL_INVALID }
      return { valid: true }
      
    case 'github':
      if (!value.trim()) return { valid: true } // Optional field
      if (!isValidGitHubRepo(value)) return { valid: false, error: VALIDATION_ERRORS.REPO_INVALID }
      return { valid: true }
      
    case 'email':
      if (!isValidEmail(value)) return { valid: false, error: VALIDATION_ERRORS.EMAIL_INVALID }
      return { valid: true }
      
    case 'webhook':
      if (!value.trim()) return { valid: true } // Optional field
      if (!isValidWebhookUrl(value)) return { valid: false, error: VALIDATION_ERRORS.WEBHOOK_INVALID }
      return { valid: true }
      
    case 'name':
      return isValidProjectName(value)
      
    default:
      return { valid: true }
  }
}

// Real-time input validation hook helper
export function getInputClassName(hasError: boolean, baseClass: string = ''): string {
  const errorClass = 'border-red-500 focus:border-red-500 focus:ring-red-500'
  const normalClass = 'border-slate-600 focus:border-indigo-500 focus:ring-indigo-500'
  
  return `${baseClass} ${hasError ? errorClass : normalClass}`.trim()
}
