/**
 * WebSocket optimization utilities
 */

/**
 * WebSocket connection manager with automatic reconnection
 */
export class WebSocketManager {
  private ws: WebSocket | null = null
  private url: string
  private protocols?: string | string[]
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private messageQueue: any[] = []
  private isConnecting = false
  private listeners: Map<string, Set<Function>> = new Map()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private heartbeatTimeout: NodeJS.Timeout | null = null

  constructor(url: string, protocols?: string | string[]) {
    this.url = url
    this.protocols = protocols
  }

  connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return Promise.resolve()
    }

    this.isConnecting = true

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url, this.protocols)

        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.startHeartbeat()
          this.flushMessageQueue()
          this.emit('open')
          resolve()
        }

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason)
          this.isConnecting = false
          this.stopHeartbeat()
          this.emit('close', event)
          
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect()
          }
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.isConnecting = false
          this.emit('error', error)
          reject(error)
        }

        this.ws.onmessage = (event) => {
          this.resetHeartbeatTimeout()
          this.emit('message', event)
        }
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    } else {
      // Queue messages when not connected
      this.messageQueue.push(data)
    }
  }

  disconnect(): void {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback)
    }
  }

  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const data = this.messageQueue.shift()
      this.ws.send(data)
    }
  }

  private scheduleReconnect(): void {
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts)
    console.log(`Reconnecting in ${delay}ms...`)
    
    setTimeout(() => {
      this.reconnectAttempts++
      this.connect().catch(err => {
        console.error('Reconnect failed:', err)
      })
    }, delay)
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    
    // Send ping every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
        this.resetHeartbeatTimeout()
      }
    }, 30000)
  }

  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout)
    }
    
    // Expect pong within 5 seconds
    this.heartbeatTimeout = setTimeout(() => {
      console.warn('Heartbeat timeout - reconnecting')
      this.disconnect()
      this.connect()
    }, 5000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout)
      this.heartbeatTimeout = null
    }
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

/**
 * Binary data optimizer for WebSocket audio streaming
 */
export class AudioBufferOptimizer {
  private bufferPool: ArrayBuffer[] = []
  private readonly poolSize = 10
  private readonly bufferSize = 2048

  getBuffer(): ArrayBuffer {
    if (this.bufferPool.length > 0) {
      return this.bufferPool.pop()!
    }
    return new ArrayBuffer(this.bufferSize * 2) // Int16 = 2 bytes per sample
  }

  returnBuffer(buffer: ArrayBuffer): void {
    if (this.bufferPool.length < this.poolSize) {
      this.bufferPool.push(buffer)
    }
  }

  clear(): void {
    this.bufferPool = []
  }
}

/**
 * Message batching for efficient WebSocket communication
 */
export class MessageBatcher {
  private queue: any[] = []
  private timeout: NodeJS.Timeout | null = null
  private readonly maxBatchSize: number
  private readonly maxWaitTime: number
  private readonly sendFn: (messages: any[]) => void

  constructor(
    sendFn: (messages: any[]) => void,
    maxBatchSize: number = 10,
    maxWaitTime: number = 50
  ) {
    this.sendFn = sendFn
    this.maxBatchSize = maxBatchSize
    this.maxWaitTime = maxWaitTime
  }

  add(message: any): void {
    this.queue.push(message)

    if (this.queue.length >= this.maxBatchSize) {
      this.flush()
    } else if (!this.timeout) {
      this.timeout = setTimeout(() => this.flush(), this.maxWaitTime)
    }
  }

  flush(): void {
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }

    if (this.queue.length > 0) {
      const messages = [...this.queue]
      this.queue = []
      this.sendFn(messages)
    }
  }

  clear(): void {
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }
    this.queue = []
  }
}
