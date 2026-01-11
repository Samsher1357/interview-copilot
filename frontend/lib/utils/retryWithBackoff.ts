/**
 * Simple retry utility with exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
}

/**
 * Execute a function with exponential backoff retry logic
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3
  const initialDelayMs = options.initialDelayMs ?? 1000
  let lastError: any
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      // Don't retry on last attempt
      if (attempt === maxRetries) break
      
      // Calculate delay with exponential backoff
      const delay = initialDelayMs * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}
