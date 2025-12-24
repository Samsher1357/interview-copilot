import { Request, Response, NextFunction } from 'express'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  message?: string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

/**
 * In-memory rate limiter
 * For production, consider using Redis for distributed rate limiting
 */
export class RateLimiter {
  private store: RateLimitStore = {}
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  /**
   * Create rate limiting middleware
   */
  createLimiter(config: RateLimitConfig) {
    const {
      windowMs,
      maxRequests,
      message = 'Too many requests, please try again later',
      skipSuccessfulRequests = false,
      skipFailedRequests = false,
    } = config

    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.getKey(req)
      const now = Date.now()

      // Get or create rate limit entry
      let entry = this.store[key]

      if (!entry || now > entry.resetTime) {
        // Create new entry or reset expired one
        entry = {
          count: 0,
          resetTime: now + windowMs,
        }
        this.store[key] = entry
      }

      // Increment counter
      entry.count++

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests)
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count))
      res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString())

      // Check if limit exceeded
      if (entry.count > maxRequests) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
        res.setHeader('Retry-After', retryAfter)
        
        return res.status(429).json({
          error: message,
          retryAfter,
        })
      }

      // Handle skip options
      if (skipSuccessfulRequests || skipFailedRequests) {
        const originalSend = res.send
        res.send = function (body: any) {
          const statusCode = res.statusCode
          
          if (
            (skipSuccessfulRequests && statusCode < 400) ||
            (skipFailedRequests && statusCode >= 400)
          ) {
            entry.count--
          }
          
          return originalSend.call(this, body)
        }
      }

      next()
    }
  }

  /**
   * Generate key for rate limiting (IP-based by default)
   */
  private getKey(req: Request): string {
    // Try to get real IP from various headers
    const ip =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.headers['x-real-ip']?.toString() ||
      req.socket.remoteAddress ||
      'unknown'

    return `ratelimit:${ip}`
  }

  /**
   * Cleanup expired entries
   */
  private cleanup() {
    const now = Date.now()
    const keys = Object.keys(this.store)

    for (const key of keys) {
      if (this.store[key].resetTime < now) {
        delete this.store[key]
      }
    }
  }

  /**
   * Clear all rate limit data
   */
  reset() {
    this.store = {}
  }

  /**
   * Stop cleanup interval
   */
  destroy() {
    clearInterval(this.cleanupInterval)
  }
}

// Singleton instance
const rateLimiter = new RateLimiter()

/**
 * Predefined rate limiters for common use cases
 */

// General API rate limiter (100 requests per 15 minutes)
export const apiLimiter = rateLimiter.createLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  message: 'Too many requests from this IP, please try again later',
})

// Strict rate limiter for expensive operations (10 requests per 15 minutes)
export const strictLimiter = rateLimiter.createLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Rate limit exceeded for this operation',
})

// Auth rate limiter (5 attempts per 15 minutes)
export const authLimiter = rateLimiter.createLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many authentication attempts',
  skipSuccessfulRequests: true,
})

// File upload rate limiter (20 uploads per hour)
export const uploadLimiter = rateLimiter.createLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  message: 'Upload limit exceeded, please try again later',
})

export { rateLimiter }
