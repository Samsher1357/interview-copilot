/**
 * Performance optimization utilities
 */

/**
 * Request deduplication to prevent duplicate API calls
 */
class RequestDeduplicator {
  private pending: Map<string, Promise<any>> = new Map()

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // If request is already pending, return the existing promise
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

/**
 * Debounce function for high-frequency events
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function to limit execution rate
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  let lastResult: any

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      lastResult = func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
    return lastResult
  }
}

/**
 * Cache with TTL (Time To Live)
 */
export class TTLCache<K, V> {
  private cache: Map<K, { value: V; expiry: number }> = new Map()
  private defaultTTL: number

  constructor(defaultTTL: number = 60000) {
    this.defaultTTL = defaultTTL
  }

  set(key: K, value: V, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL)
    this.cache.set(key, { value, expiry })
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key)
    if (!item) return undefined

    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      return undefined
    }

    return item.value
  }

  has(key: K): boolean {
    return this.get(key) !== undefined
  }

  delete(key: K): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key)
      }
    }
  }
}

/**
 * Batch processor for grouping operations
 */
export class BatchProcessor<T> {
  private queue: T[] = []
  private timeout: NodeJS.Timeout | null = null
  private processor: (items: T[]) => void
  private batchSize: number
  private maxWait: number

  constructor(
    processor: (items: T[]) => void,
    batchSize: number = 10,
    maxWait: number = 100
  ) {
    this.processor = processor
    this.batchSize = batchSize
    this.maxWait = maxWait
  }

  add(item: T): void {
    this.queue.push(item)

    // Process immediately if batch is full
    if (this.queue.length >= this.batchSize) {
      this.flush()
      return
    }

    // Schedule processing
    if (!this.timeout) {
      this.timeout = setTimeout(() => {
        this.flush()
      }, this.maxWait)
    }
  }

  flush(): void {
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }

    if (this.queue.length > 0) {
      const items = [...this.queue]
      this.queue = []
      this.processor(items)
    }
  }
}

/**
 * Simple LRU (Least Recently Used) Cache
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>
  private maxSize: number

  constructor(maxSize: number = 100) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set(key: K, value: V): void {
    // Remove if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // Add to end
    this.cache.set(key, value)

    // Remove oldest if over limit
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
  }

  clear(): void {
    this.cache.clear()
  }
}

/**
 * Adaptive buffer for managing streaming data
 */
export class AdaptiveBuffer {
  private buffer: string = ''
  private minSize: number
  private maxSize: number
  private lastFlush: number = 0
  private flushCallback: (data: string) => void

  constructor(
    flushCallback: (data: string) => void,
    minSize: number = 5,
    maxSize: number = 50
  ) {
    this.flushCallback = flushCallback
    this.minSize = minSize
    this.maxSize = maxSize
  }

  add(chunk: string): void {
    this.buffer += chunk

    // Flush conditions
    const shouldFlush =
      this.buffer.length >= this.maxSize ||
      (this.buffer.length >= this.minSize && /[.!?\n]/.test(chunk)) ||
      (Date.now() - this.lastFlush > 100 && this.buffer.length > 0)

    if (shouldFlush) {
      this.flush()
    }
  }

  flush(): void {
    if (this.buffer.length > 0) {
      this.flushCallback(this.buffer)
      this.buffer = ''
      this.lastFlush = Date.now()
    }
  }

  clear(): void {
    this.buffer = ''
  }
}
