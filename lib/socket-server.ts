import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'

let io: SocketIOServer | null = null

export function initializeSocketIO(httpServer: HTTPServer) {
  if (io) {
    return io
  }

  io = new SocketIOServer(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.NEXT_PUBLIC_APP_URL || '*'
        : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // Handle custom events
    socket.on('event', (event) => {
      console.log('Received event:', event.type)
      
      // Broadcast to all other clients in the same session
      if (event.sessionId) {
        socket.to(event.sessionId).emit('event', event)
      } else {
        // Broadcast to all other clients
        socket.broadcast.emit('event', event)
      }
    })

    // Join session room
    socket.on('join:session', (sessionId: string) => {
      socket.join(sessionId)
      console.log(`Client ${socket.id} joined session ${sessionId}`)
      
      // Notify others in the room
      socket.to(sessionId).emit('event', {
        type: 'user:connected',
        payload: { socketId: socket.id },
        timestamp: Date.now(),
      })
    })

    // Leave session room
    socket.on('leave:session', (sessionId: string) => {
      socket.leave(sessionId)
      console.log(`Client ${socket.id} left session ${sessionId}`)
      
      // Notify others in the room
      socket.to(sessionId).emit('event', {
        type: 'user:disconnected',
        payload: { socketId: socket.id },
        timestamp: Date.now(),
      })
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })

    socket.on('error', (error) => {
      console.error('Socket error:', error)
    })
  })

  return io
}

export function getSocketIO(): SocketIOServer | null {
  return io
}

