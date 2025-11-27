/**
 * Response caching service for AI analysis
 * Caches responses based on conversation context to reduce API calls
 */

import { TTLCache, LRUCache } from '../utils/performanceUtils'
import { TranscriptEntry } from '../store'

interface CacheKey {
  transcripts: string
  language: string
  context: string
}

class ResponseCacheService {
  private cache: LRUCache<string, any>
  private ttlCache: TTLCache<string, any>
  
  constructor() {
    this.cache = new LRUCache(50) // Keep last 50 responses
    this.ttlCache = new TTLCache(5 * 60 * 1000) // 5 minute TTL
  }

  /**
   * Generate cache key from request parameters
   */
  private generateKey(
    transcripts: TranscriptEntry[],
    language: string,
    context: any
  ): string {
    const transcriptText = transcripts
      .slice(-5) // Use last 5 transcripts for key
      .map(t => `${t.speaker}:${t.text}`)
      .join('|')
    
    const contextStr = JSON.stringify({
      role: context?.jobRole,
      company: context?.company,
      skills: context?.skills?.slice(0, 3), // First 3 skills only
    })

    return `${language}:${transcriptText}:${contextStr}`
  }

  /**
   * Get cached response if available
   */
  get(
    transcripts: TranscriptEntry[],
    language: string,
    context: any
  ): any | null {
    const key = this.generateKey(transcripts, language, context)
    
    // Check TTL cache first (time-based expiration)
    const ttlResult = this.ttlCache.get(key)
    if (ttlResult) {
      return ttlResult
    }

    // Fall back to LRU cache
    return this.cache.get(key) || null
  }

  /**
   * Store response in cache
   */
  set(
    transcripts: TranscriptEntry[],
    language: string,
    context: any,
    response: any
  ): void {
    const key = this.generateKey(transcripts, language, context)
    this.cache.set(key, response)
    this.ttlCache.set(key, response, 5 * 60 * 1000) // 5 minutes
  }

  /**
   * Check if response is cached
   */
  has(
    transcripts: TranscriptEntry[],
    language: string,
    context: any
  ): boolean {
    const key = this.generateKey(transcripts, language, context)
    return this.ttlCache.has(key) || this.cache.get(key) !== undefined
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.cache.clear()
    this.ttlCache.clear()
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    this.ttlCache.cleanup()
  }
}

export const responseCacheService = new ResponseCacheService()

// Periodic cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    responseCacheService.cleanup()
  }, 5 * 60 * 1000)
}
