import { Request, Response, NextFunction } from 'express'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

/**
 * Simple in-memory rate limiter
 */
const store: RateLimitStore = {}

function createLimiter(windowMs: number, maxRequests: number, message: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() 
      || req.headers['x-real-ip']?.toString() 
      || req.socket.remoteAddress 
      || 'unknown'
    
    const key = `ratelimit:${ip}`
    const now = Date.now()
    let entry = store[key]

    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs }
      store[key] = entry
    }

    entry.count++

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
      res.setHeader('Retry-After', retryAfter)
      return res.status(429).json({ error: message, retryAfter })
    }

    next()
  }
}

// API rate limiter (100 requests per 15 minutes)
export const apiLimiter = createLimiter(
  15 * 60 * 1000,
  100,
  'Too many requests from this IP, please try again later'
)

// Strict rate limiter for expensive operations (10 requests per 15 minutes)
export const strictLimiter = createLimiter(
  15 * 60 * 1000,
  10,
  'Rate limit exceeded for this operation'
)

// File upload rate limiter (20 uploads per hour)
export const uploadLimiter = createLimiter(
  60 * 60 * 1000,
  20,
  'Upload limit exceeded, please try again later'
)
