'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export function useSocket(url?: string) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // For Next.js, we'll use the API route as the socket endpoint
    const socketUrl = url || (typeof window !== 'undefined' ? window.location.origin : '')
    
    if (!socketUrl) return

    // Initialize socket connection
    const socketInstance = io(socketUrl, {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id)
      setIsConnected(true)
      setError(null)
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      setIsConnected(false)
      if (reason === 'io server disconnect') {
        // Server disconnected, reconnect manually
        socketInstance.connect()
      }
    })

    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err)
      setError(err.message)
      setIsConnected(false)
    })

    socketRef.current = socketInstance
    setSocket(socketInstance)

    return () => {
      socketInstance.close()
      socketRef.current = null
    }
  }, [url])

  return { socket, isConnected, error }
}

