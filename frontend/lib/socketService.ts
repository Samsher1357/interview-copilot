'use client'

import { io, Socket } from 'socket.io-client'

class SocketService {
  private socket: Socket | null = null
  private socketPromise: Promise<Socket> | null = null
  private shouldReconnect: boolean = true

  async getSocket(): Promise<Socket> {
    // Return existing connected socket
    if (this.socket?.connected) {
      return this.socket
    }

    // Return pending connection promise to prevent race condition
    if (this.socketPromise) {
      return this.socketPromise
    }

    // Create new connection
    this.socketPromise = this.createSocket()
    
    try {
      this.socket = await this.socketPromise
      return this.socket
    } finally {
      this.socketPromise = null
    }
  }

  private createSocket(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      
      // Reset reconnection flag when creating new socket
      this.shouldReconnect = true
      
      const socket = io(apiUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        autoConnect: true,
        timeout: 10000,
      })

      const connectTimeout = setTimeout(() => {
        socket.close()
        reject(new Error('Socket connection timeout'))
      }, 10000)

      socket.on('connect', () => {
        clearTimeout(connectTimeout)
        console.log('✅ Socket connected:', socket.id)
        resolve(socket)
      })

      socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason)
        
        // Prevent reconnection if explicitly disconnected
        if (!this.shouldReconnect && socket.io.opts.reconnection) {
          socket.io.opts.reconnection = false
        }
      })

      socket.on('connect_error', (error) => {
        clearTimeout(connectTimeout)
        console.error('Socket connection error:', error)
        reject(error)
      })
    })
  }

  disconnect() {
    // Disable reconnection before disconnecting
    this.shouldReconnect = false
    
    if (this.socket) {
      // Disable reconnection on the socket instance
      this.socket.io.opts.reconnection = false
      this.socket.disconnect()
      this.socket = null
    }
    this.socketPromise = null
  }
  
  enableReconnection() {
    this.shouldReconnect = true
    if (this.socket) {
      this.socket.io.opts.reconnection = true
    }
  }
}

export const socketService = new SocketService()
