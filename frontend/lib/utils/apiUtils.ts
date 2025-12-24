/**
 * API Utility Functions
 * Retry logic, error handling, and request helpers
 */

export interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  retryableStatuses?: number[]
}

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public context?: any
  ) {
    super(message)
    this.name = 'APIError'
  }
}

/**
 * Sleep utility for delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Calculate exponential backoff delay
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
  const { baseDelay = 1000, maxDelay = 30000, backoffMultiplier = 2 } = options
  const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt), maxDelay)
  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1)
  return Math.max(0, delay + jitter)
}

/**
 * Check if error is retryable
 */
function isRetryable(error: any, options: RetryOptions): boolean {
  const { retryableStatuses = [408, 429, 500, 502, 503, 504] } = options

  // Network errors
  if (error.name === 'TypeError' || error.message?.includes('fetch')) {
    return true
  }

  // HTTP status codes
  if (error.statusCode && retryableStatuses.includes(error.statusCode)) {
    return true
  }

  return false
}

/**
 * Fetch with retry logic and exponential backoff
 */
export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
  } = retryOptions

  let lastError: any

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.error || errorJson.message || errorMessage
        } catch {
          // Use text if not JSON
          errorMessage = errorText || errorMessage
        }

        throw new APIError(errorMessage, response.status, { url, attempt })
      }

      // Success
      const data = await response.json()
      return data as T
    } catch (error: any) {
      lastError = error

      // Don't retry if not retryable or last attempt
      if (!isRetryable(error, retryOptions) || attempt === maxRetries) {
        break
      }

      // Wait before retry
      const delay = calculateDelay(attempt, retryOptions)
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`)
      await sleep(delay)
    }
  }

  // All retries failed
  throw lastError instanceof APIError
    ? lastError
    : new APIError(
        lastError?.message || 'Request failed',
        lastError?.statusCode,
        { url, attempts: maxRetries + 1 }
      )
}

/**
 * Enhanced error message formatting
 */
export function formatErrorMessage(error: any): { message: string; description?: string } {
  if (error instanceof APIError) {
    const message = error.message
    const description = error.statusCode 
      ? `Error Code: ${error.statusCode}${error.context?.attempts ? ` (${error.context.attempts} attempts)` : ''}`
      : undefined

    return { message, description }
  }

  if (error.name === 'AbortError') {
    return {
      message: 'Request cancelled',
      description: 'The operation was cancelled by the user',
    }
  }

  if (error.message?.includes('fetch') || error.message?.includes('network')) {
    return {
      message: 'Network error',
      description: 'Please check your internet connection and try again',
    }
  }

  return {
    message: error.message || 'An unexpected error occurred',
    description: 'Please try again later',
  }
}

/**
 * Request deduplication
 */
class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>()

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Return existing promise if request is in flight
    if (this.pending.has(key)) {
      return this.pending.get(key)!
    }

    // Create new request
    const promise = fn().finally(() => {
      this.pending.delete(key)
    })

    this.pending.set(key, promise)
    return promise
  }

  clear() {
    this.pending.clear()
  }
}

export const requestDeduplicator = new RequestDeduplicator()
