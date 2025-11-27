import { Request, Response, NextFunction } from 'express'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

class RateLimiter {
  private store: RateLimitStore = {}
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  private cleanup() {
    const now = Date.now()
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key]
      }
    })
  }

  /**
   * Create a rate limit middleware
   * @param maxRequests Maximum number of requests allowed
   * @param windowMs Time window in milliseconds
   * @param message Optional custom error message
   */
  createLimiter(maxRequests: number, windowMs: number, message?: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const identifier = this.getIdentifier(req)
      const now = Date.now()

      if (!this.store[identifier] || this.store[identifier].resetTime < now) {
        // Create new entry or reset expired entry
        this.store[identifier] = {
          count: 1,
          resetTime: now + windowMs,
        }
        return next()
      }

      if (this.store[identifier].count < maxRequests) {
        // Increment count
        this.store[identifier].count++
        return next()
      }

      // Rate limit exceeded
      const retryAfter = Math.ceil((this.store[identifier].resetTime - now) / 1000)
      res.setHeader('Retry-After', retryAfter.toString())
      res.setHeader('X-RateLimit-Limit', maxRequests.toString())
      res.setHeader('X-RateLimit-Remaining', '0')
      res.setHeader('X-RateLimit-Reset', this.store[identifier].resetTime.toString())

      return res.status(429).json({
        error: message || 'Too many requests, please try again later',
        retryAfter,
      })
    }
  }

  /**
   * Get identifier for rate limiting (IP address or custom header)
   */
  private getIdentifier(req: Request): string {
    // Try to get IP from various headers (in case behind proxy)
    const forwarded = req.headers['x-forwarded-for']
    const ip = typeof forwarded === 'string' 
      ? forwarded.split(',')[0].trim()
      : req.socket.remoteAddress || 'unknown'
    
    return ip
  }

  destroy() {
    clearInterval(this.cleanupInterval)
  }
}

export const rateLimiter = new RateLimiter()

// Pre-configured limiters for different endpoints
export const apiLimiter = rateLimiter.createLimiter(
  100, // 100 requests
  15 * 60 * 1000, // per 15 minutes
  'Too many API requests. Please try again in a few minutes.'
)

export const strictLimiter = rateLimiter.createLimiter(
  20, // 20 requests
  60 * 1000, // per minute
  'Too many requests. Please slow down.'
)

export const streamLimiter = rateLimiter.createLimiter(
  30, // 30 requests
  60 * 1000, // per minute
  'Too many streaming requests. Please wait before trying again.'
)
