import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

interface CacheEntry {
  data: any
  timestamp: number
  ttl: number
}

/**
 * Simple in-memory cache for API responses
 * For production, consider using Redis or similar
 */
class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map()
  private maxSize: number = 100
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired entries every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 2 * 60 * 1000)
  }

  /**
   * Generate cache key from request
   */
  private generateKey(req: Request): string {
    const body = req.body
    // Create hash of request body for consistent keys
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify({
        transcripts: body.transcripts?.slice(-5), // Last 5 transcripts
        language: body.language,
        simpleEnglish: body.simpleEnglish,
        context: {
          jobRole: body.interviewContext?.jobRole,
          company: body.interviewContext?.company,
        },
      }))
      .digest('hex')
    
    return `${req.path}:${hash}`
  }

  /**
   * Get cached response
   */
  get(req: Request): any | null {
    const key = this.generateKey(req)
    const entry = this.cache.get(key)

    if (!entry) return null

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  /**
   * Set cached response
   */
  set(req: Request, data: any, ttl: number = 60000): void {
    const key = this.generateKey(req)
    
    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  /**
   * Clear specific cache entry
   */
  delete(req: Request): void {
    const key = this.generateKey(req)
    this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.clear()
  }
}

export const responseCache = new ResponseCache()

/**
 * Cache middleware for GET requests
 * Usage: router.get('/path', cacheMiddleware(60000), handler)
 */
export function cacheMiddleware(ttl: number = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next()
    }

    const cached = responseCache.get(req)
    if (cached) {
      res.setHeader('X-Cache', 'HIT')
      return res.json(cached)
    }

    // Override res.json to cache response
    const originalJson = res.json.bind(res)
    res.json = function (data: any) {
      responseCache.set(req, data, ttl)
      res.setHeader('X-Cache', 'MISS')
      return originalJson(data)
    }

    next()
  }
}

/**
 * Selective cache middleware for POST requests with specific patterns
 * Useful for caching analysis results
 */
export function selectiveCacheMiddleware(options: {
  ttl?: number
  shouldCache?: (req: Request) => boolean
} = {}) {
  const { ttl = 30000, shouldCache = () => true } = options

  return (req: Request, res: Response, next: NextFunction) => {
    // Check if we should cache this request
    if (!shouldCache(req)) {
      return next()
    }

    // Check cache
    const cached = responseCache.get(req)
    if (cached) {
      res.setHeader('X-Cache', 'HIT')
      return res.json(cached)
    }

    // Intercept response to cache it
    const originalJson = res.json.bind(res)
    res.json = function (data: any) {
      // Only cache successful responses
      if (res.statusCode === 200) {
        responseCache.set(req, data, ttl)
      }
      res.setHeader('X-Cache', 'MISS')
      return originalJson(data)
    }

    next()
  }
}
