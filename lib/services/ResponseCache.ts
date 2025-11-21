/**
 * Response Cache Service
 * Caches AI responses for similar questions to provide instant answers
 * Dramatically improves performance for common interview questions
 */

import { AIResponse } from '../store'

interface CacheEntry {
  key: string
  responses: AIResponse[]
  timestamp: number
  accessCount: number
}

export class ResponseCacheService {
  private cache: Map<string, CacheEntry>
  private maxCacheSize: number
  private cacheDuration: number // in milliseconds

  constructor(maxCacheSize = 50, cacheDurationMinutes = 30) {
    this.cache = new Map()
    this.maxCacheSize = maxCacheSize
    this.cacheDuration = cacheDurationMinutes * 60 * 1000
  }

  /**
   * Generate cache key from transcript text
   * Uses similarity matching to find related questions
   */
  private generateKey(text: string): string {
    // Normalize and extract key words
    const normalized = text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace

    // Extract key question words for better matching
    const keyWords = normalized
      .split(' ')
      .filter(word => 
        word.length > 3 && // Ignore short words
        !['what', 'when', 'where', 'which', 'could', 'would', 'should', 'tell', 'describe'].includes(word)
      )
      .slice(0, 5) // Take first 5 significant words
      .sort() // Sort for consistent keys
      .join('_')

    return keyWords || normalized.slice(0, 50)
  }

  /**
   * Check if we have a cached response for similar question
   */
  get(text: string): AIResponse[] | null {
    const key = this.generateKey(text)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if cache is still valid
    const age = Date.now() - entry.timestamp
    if (age > this.cacheDuration) {
      this.cache.delete(key)
      return null
    }

    // Update access count and timestamp
    entry.accessCount++
    entry.timestamp = Date.now()

    console.log(`✅ Cache hit for: "${text}" (accessed ${entry.accessCount} times)`)
    
    // Return cloned responses with updated timestamps
    return entry.responses.map(r => ({
      ...r,
      id: `${r.id}-cached-${Date.now()}`,
      timestamp: Date.now(),
    }))
  }

  /**
   * Store responses in cache
   */
  set(text: string, responses: AIResponse[]): void {
    const key = this.generateKey(text)

    // Evict least used entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLeastUsed()
    }

    this.cache.set(key, {
      key,
      responses,
      timestamp: Date.now(),
      accessCount: 0,
    })

    console.log(`💾 Cached response for: "${text}"`)
  }

  /**
   * Evict least recently used entry
   */
  private evictLeastUsed(): void {
    let leastUsedKey: string | null = null
    let leastAccessCount = Infinity
    let oldestTimestamp = Infinity

    for (const [key, entry] of this.cache.entries()) {
      // Prioritize by access count, then by age
      if (entry.accessCount < leastAccessCount || 
          (entry.accessCount === leastAccessCount && entry.timestamp < oldestTimestamp)) {
        leastUsedKey = key
        leastAccessCount = entry.accessCount
        oldestTimestamp = entry.timestamp
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey)
      console.log(`🗑️ Evicted cache entry: ${leastUsedKey}`)
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
    console.log('🗑️ Cache cleared')
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hitRate: number } {
    let totalAccess = 0
    for (const entry of this.cache.values()) {
      totalAccess += entry.accessCount
    }

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: totalAccess > 0 ? (totalAccess / this.cache.size) : 0,
    }
  }

  /**
   * Check if similar question exists in cache
   */
  has(text: string): boolean {
    const key = this.generateKey(text)
    const entry = this.cache.get(key)
    
    if (!entry) {
      return false
    }

    const age = Date.now() - entry.timestamp
    return age <= this.cacheDuration
  }
}

// Singleton instance
export const responseCacheService = new ResponseCacheService()

