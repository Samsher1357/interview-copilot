/**
 * Real-time Event Service
 * WebSocket-based event system for real-time communication
 * Enables multi-user scenarios and live synchronization
 */

import { io, Socket } from 'socket.io-client'
import { TranscriptEntry, AIResponse } from '../store'

export type EventType = 
  | 'transcript:new'
  | 'ai:response'
  | 'ai:analyzing'
  | 'user:connected'
  | 'user:disconnected'
  | 'session:started'
  | 'session:ended'
  | 'error'

export interface RealtimeEvent<T = any> {
  type: EventType
  payload: T
  timestamp: number
  userId?: string
  sessionId?: string
}

export interface EventHandler<T = any> {
  (event: RealtimeEvent<T>): void | Promise<void>
}

export class RealtimeEventService {
  private socket: Socket | null = null
  private isConnected: boolean = false
  private eventHandlers: Map<EventType, Set<EventHandler>>
  private sessionId: string | null = null
  private userId: string | null = null

  constructor() {
    this.eventHandlers = new Map()
  }

  /**
   * Initialize WebSocket connection
   */
  async connect(options?: { sessionId?: string; userId?: string }): Promise<void> {
    if (this.socket?.connected) {
      console.warn('Already connected to WebSocket')
      return
    }

    this.sessionId = options?.sessionId || this.generateId()
    this.userId = options?.userId || this.generateId()

    try {
      this.socket = io({
        path: '/api/socket',
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling'],
      })

      this.setupSocketHandlers()
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, 10000)

        this.socket?.on('connect', () => {
          clearTimeout(timeout)
          this.isConnected = true
          console.log('WebSocket connected:', this.socket?.id)
          this.emit('user:connected', { userId: this.userId })
          resolve()
        })

        this.socket?.on('connect_error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
      throw error
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.emit('user:disconnected', { userId: this.userId })
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
      console.log('WebSocket disconnected')
    }
  }

  /**
   * Check if connected
   */
  connected(): boolean {
    return this.isConnected && this.socket?.connected === true
  }

  /**
   * Emit an event to the server
   */
  emit<T = any>(type: EventType, payload: T): void {
    if (!this.socket?.connected) {
      console.warn('Cannot emit event, not connected:', type)
      return
    }

    const event: RealtimeEvent<T> = {
      type,
      payload,
      timestamp: Date.now(),
      userId: this.userId || undefined,
      sessionId: this.sessionId || undefined,
    }

    this.socket.emit('event', event)
  }

  /**
   * Subscribe to an event
   */
  on<T = any>(type: EventType, handler: EventHandler<T>): () => void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, new Set())
    }

    this.eventHandlers.get(type)!.add(handler as EventHandler)

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(type)
      if (handlers) {
        handlers.delete(handler as EventHandler)
      }
    }
  }

  /**
   * Subscribe to all events
   */
  onAny(handler: EventHandler): () => void {
    const unsubscribers: Array<() => void> = []

    // Subscribe to all known event types
    const eventTypes: EventType[] = [
      'transcript:new',
      'ai:response',
      'ai:analyzing',
      'user:connected',
      'user:disconnected',
      'session:started',
      'session:ended',
      'error',
    ]

    eventTypes.forEach((type) => {
      unsubscribers.push(this.on(type, handler))
    })

    // Return combined unsubscribe function
    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  }

  /**
   * Emit transcript event
   */
  emitTranscript(transcript: TranscriptEntry): void {
    this.emit('transcript:new', transcript)
  }

  /**
   * Emit AI response event
   */
  emitAIResponse(response: AIResponse): void {
    this.emit('ai:response', response)
  }

  /**
   * Emit analyzing status
   */
  emitAnalyzing(isAnalyzing: boolean): void {
    this.emit('ai:analyzing', { isAnalyzing })
  }

  /**
   * Setup socket event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.socket) return

    this.socket.on('event', (event: RealtimeEvent) => {
      this.handleIncomingEvent(event)
    })

    this.socket.on('disconnect', () => {
      this.isConnected = false
      console.log('WebSocket disconnected')
    })

    this.socket.on('reconnect', () => {
      this.isConnected = true
      console.log('WebSocket reconnected')
    })

    this.socket.on('error', (error: any) => {
      console.error('WebSocket error:', error)
      this.handleIncomingEvent({
        type: 'error',
        payload: { error: error.message || 'Unknown error' },
        timestamp: Date.now(),
      })
    })
  }

  /**
   * Handle incoming events
   */
  private handleIncomingEvent(event: RealtimeEvent): void {
    const handlers = this.eventHandlers.get(event.type)
    
    if (handlers) {
      handlers.forEach(async (handler) => {
        try {
          await handler(event)
        } catch (error) {
          console.error(`Error handling event ${event.type}:`, error)
        }
      })
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId
  }

  /**
   * Get current user ID
   */
  getUserId(): string | null {
    return this.userId
  }
}

// Singleton instance
export const realtimeEventService = new RealtimeEventService()

