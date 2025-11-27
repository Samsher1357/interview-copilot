import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'

let io: SocketIOServer | null = null

export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io
  }

  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000'

  io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    // Connection settings to prevent memory leaks
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6, // 1MB
    connectTimeout: 45000,
  })

  io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id)

    // Handle custom events
    socket.on('event', (event) => {
      console.log('📨 Received event:', event.type)
      
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
      console.log(`👥 Client ${socket.id} joined session ${sessionId}`)
      
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
      console.log(`👋 Client ${socket.id} left session ${sessionId}`)
      
      // Notify others in the room
      socket.to(sessionId).emit('event', {
        type: 'user:disconnected',
        payload: { socketId: socket.id },
        timestamp: Date.now(),
      })
    })

    // Handle realtime transcript updates
    socket.on('transcript:update', (data) => {
      if (data.sessionId) {
        socket.to(data.sessionId).emit('transcript:update', data)
      } else {
        socket.broadcast.emit('transcript:update', data)
      }
    })

    // Handle realtime AI response updates
    socket.on('ai:response', (data) => {
      if (data.sessionId) {
        socket.to(data.sessionId).emit('ai:response', data)
      } else {
        socket.broadcast.emit('ai:response', data)
      }
    })

    socket.on('disconnect', (reason) => {
      console.log('❌ Client disconnected:', socket.id, reason)
      
      // Clean up: leave all rooms
      const rooms = Array.from(socket.rooms)
      rooms.forEach(room => {
        if (room !== socket.id) {
          socket.leave(room)
        }
      })
    })

    socket.on('error', (error) => {
      console.error('❌ Socket error:', error)
      // Close the connection on error
      socket.disconnect(true)
    })
  })

  return io
}

export function getSocketIO(): SocketIOServer | null {
  return io
}

