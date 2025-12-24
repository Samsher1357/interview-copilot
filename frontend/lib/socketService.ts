'use client'

import { io, Socket } from 'socket.io-client'

class SocketService {
  private socket: Socket | null = null
  private connecting = false

  getSocket(): Socket {
    if (this.socket?.connected) {
      return this.socket
    }

    if (this.connecting && this.socket) {
      return this.socket
    }

    this.connecting = true
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    
    this.socket = io(apiUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      autoConnect: true,
    })

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id)
      this.connecting = false
    })

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason)
      this.connecting = false
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      this.connecting = false
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connecting = false
    }
  }
}

export const socketService = new SocketService()
