/**
 * Centralized Error Messages and Utilities
 * Provides consistent, user-friendly error handling across the application
 */

// Standard API error responses
export const API_ERRORS = {
  // Authentication errors
  UNAUTHORIZED: {
    message: 'Please sign in to access this feature',
    code: 'UNAUTHORIZED',
    status: 401,
  },
  SESSION_EXPIRED: {
    message: 'Your session has expired. Please sign in again',
    code: 'SESSION_EXPIRED',
    status: 401,
  },

  // Authorization errors
  FORBIDDEN: {
    message: 'You do not have permission to perform this action',
    code: 'FORBIDDEN',
    status: 403,
  },
  PLAN_REQUIRED: {
    message: 'This feature requires a Pro or higher plan',
    code: 'PLAN_REQUIRED',
    status: 403,
  },
  RATE_LIMITED: {
    message: 'Too many requests. Please wait a moment and try again',
    code: 'RATE_LIMITED',
    status: 429,
  },

  // Resource errors
  NOT_FOUND: {
    message: 'The requested resource was not found',
    code: 'NOT_FOUND',
    status: 404,
  },
  USER_NOT_FOUND: {
    message: 'User account not found. Please sign in again',
    code: 'USER_NOT_FOUND',
    status: 404,
  },
  PROJECT_NOT_FOUND: {
    message: 'Project not found or you do not have access',
    code: 'PROJECT_NOT_FOUND',
    status: 404,
  },
  SCAN_NOT_FOUND: {
    message: 'Scan results not found',
    code: 'SCAN_NOT_FOUND',
    status: 404,
  },

  // Validation errors
  INVALID_INPUT: {
    message: 'Invalid input. Please check your data and try again',
    code: 'INVALID_INPUT',
    status: 400,
  },
  INVALID_URL: {
    message: 'Please enter a valid URL (e.g., https://example.com)',
    code: 'INVALID_URL',
    status: 400,
  },
  INVALID_REPO: {
    message: 'Please enter a valid GitHub repository (e.g., owner/repo)',
    code: 'INVALID_REPO',
    status: 400,
  },

  // Limit errors
  PROJECT_LIMIT: {
    message: 'You have reached your project limit. Upgrade to add more',
    code: 'PROJECT_LIMIT',
    status: 403,
  },
  SCAN_LIMIT: {
    message: 'Daily scan limit reached. Upgrade for unlimited scans',
    code: 'SCAN_LIMIT',
    status: 429,
  },

  // Integration errors
  GITHUB_NOT_CONNECTED: {
    message: 'GitHub is not connected. Connect in Settings to use this feature',
    code: 'GITHUB_NOT_CONNECTED',
    status: 400,
  },
  VERCEL_NOT_CONNECTED: {
    message: 'Vercel is not connected. Connect in Settings to use this feature',
    code: 'VERCEL_NOT_CONNECTED',
    status: 400,
  },
  OAUTH_FAILED: {
    message: 'Authentication failed. Please try again',
    code: 'OAUTH_FAILED',
    status: 400,
  },

  // Service errors
  SCAN_FAILED: {
    message: 'Scan failed. The website may be unavailable or blocking requests',
    code: 'SCAN_FAILED',
    status: 500,
  },
  PDF_FAILED: {
    message: 'Failed to generate PDF. Please try again',
    code: 'PDF_FAILED',
    status: 500,
  },
  EMAIL_FAILED: {
    message: 'Failed to send email notification',
    code: 'EMAIL_FAILED',
    status: 500,
  },
  WEBHOOK_FAILED: {
    message: 'Failed to send webhook notification',
    code: 'WEBHOOK_FAILED',
    status: 500,
  },

  // Server errors
  INTERNAL_ERROR: {
    message: 'Something went wrong. Please try again later',
    code: 'INTERNAL_ERROR',
    status: 500,
  },
  SERVICE_UNAVAILABLE: {
    message: 'Service temporarily unavailable. Please try again later',
    code: 'SERVICE_UNAVAILABLE',
    status: 503,
  },
} as const

// Type for error keys
export type APIErrorKey = keyof typeof API_ERRORS

// Helper to create error response
export function createErrorResponse(
  errorKey: APIErrorKey,
  details?: string
): { error: string; code: string; details?: string } {
  const err = API_ERRORS[errorKey]
  return {
    error: err.message,
    code: err.code,
    ...(details && { details }),
  }
}

// Helper to get status code
export function getErrorStatus(errorKey: APIErrorKey): number {
  return API_ERRORS[errorKey].status
}

// User-friendly error messages for common scenarios
export const USER_FRIENDLY_ERRORS: Record<string, string> = {
  // Network errors
  'Failed to fetch': 'Unable to connect. Please check your internet connection',
  'NetworkError': 'Network error. Please check your connection and try again',
  'TypeError: Failed to fetch': 'Unable to reach the server. Please try again',

  // Auth errors
  'Unauthorized': 'Please sign in to continue',
  'Not authenticated': 'Your session has expired. Please sign in again',

  // Scan errors
  'Navigation timeout': 'The website took too long to load',
  'net::ERR_NAME_NOT_RESOLVED': 'Could not find that website. Please check the URL',
  'net::ERR_CONNECTION_REFUSED': 'Could not connect to the website',
  'net::ERR_CONNECTION_TIMED_OUT': 'Connection timed out. The website may be slow',
  'Protocol error': 'Unable to scan this website',

  // Generic fallback
  'default': 'Something went wrong. Please try again',
}

/**
 * Converts a raw error message to a user-friendly one
 */
export function toUserFriendlyError(error: unknown): string {
  if (typeof error === 'string') {
    // Check for known error patterns
    for (const [pattern, message] of Object.entries(USER_FRIENDLY_ERRORS)) {
      if (error.toLowerCase().includes(pattern.toLowerCase())) {
        return message
      }
    }
    return error
  }

  if (error instanceof Error) {
    // Check for known error patterns
    for (const [pattern, message] of Object.entries(USER_FRIENDLY_ERRORS)) {
      if (error.message.toLowerCase().includes(pattern.toLowerCase())) {
        return message
      }
    }
    return error.message
  }

  return USER_FRIENDLY_ERRORS['default']
}

/**
 * Error boundary fallback component text
 */
export const ERROR_BOUNDARY_TEXT = {
  title: 'Something went wrong',
  description: 'We encountered an unexpected error. Please try refreshing the page.',
  refreshButton: 'Refresh Page',
  supportText: 'If the problem persists, please contact support.',
}
