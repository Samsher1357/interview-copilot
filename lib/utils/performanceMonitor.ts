/**
 * Performance Monitor
 * Tracks and logs performance metrics for optimization
 */

interface PerformanceMetric {
  name: string
  startTime: number
  endTime?: number
  duration?: number
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric>
  private enabled: boolean

  constructor() {
    this.metrics = new Map()
    this.enabled = process.env.NODE_ENV === 'development'
  }

  /**
   * Start tracking a performance metric
   */
  start(name: string): void {
    if (!this.enabled) return

    this.metrics.set(name, {
      name,
      startTime: performance.now(),
    })
  }

  /**
   * End tracking and log duration
   */
  end(name: string): number | null {
    if (!this.enabled) return null

    const metric = this.metrics.get(name)
    if (!metric) {
      console.warn(`Performance metric "${name}" not found`)
      return null
    }

    const endTime = performance.now()
    const duration = endTime - metric.startTime

    metric.endTime = endTime
    metric.duration = duration

    // Log if slow
    if (duration > 100) {
      console.warn(`⚠️ Slow operation: ${name} took ${duration.toFixed(2)}ms`)
    } else if (duration > 50) {
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`)
    } else {
      console.log(`✅ ${name}: ${duration.toFixed(2)}ms`)
    }

    return duration
  }

  /**
   * Get metric duration without ending it
   */
  getDuration(name: string): number | null {
    if (!this.enabled) return null

    const metric = this.metrics.get(name)
    if (!metric) return null

    return performance.now() - metric.startTime
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear()
  }

  /**
   * Get all metrics
   */
  getAll(): PerformanceMetric[] {
    return Array.from(this.metrics.values())
  }

  /**
   * Get average duration for a metric name
   */
  getAverage(namePattern: string): number | null {
    const matching = Array.from(this.metrics.values()).filter(m =>
      m.name.includes(namePattern) && m.duration !== undefined
    )

    if (matching.length === 0) return null

    const total = matching.reduce((sum, m) => sum + (m.duration || 0), 0)
    return total / matching.length
  }
}

export const perfMonitor = new PerformanceMonitor()

// Convenience function for measuring async operations
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  perfMonitor.start(name)
  try {
    const result = await operation()
    perfMonitor.end(name)
    return result
  } catch (error) {
    perfMonitor.end(name)
    throw error
  }
}

// Convenience function for measuring sync operations
export function measureSync<T>(name: string, operation: () => T): T {
  perfMonitor.start(name)
  try {
    const result = operation()
    perfMonitor.end(name)
    return result
  } catch (error) {
    perfMonitor.end(name)
    throw error
  }
}

