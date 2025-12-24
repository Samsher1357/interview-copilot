import './config/env' // Load environment variables first
import { validateEnvironment } from './config/validateEnv'
import express from 'express'
import { createServer } from 'node:http'
import cors from 'cors'
import { initializeSocketIO } from './socket/socketHandler'
import { setupRoutes } from './routes'
import { securityHeaders, requestLogger, errorSanitizer } from './middleware/security'

// Validate environment variables before starting
validateEnvironment()

const app = express()
const httpServer = createServer(app)
const PORT = process.env.PORT || 3001

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Security middleware
app.use(securityHeaders)
app.use(requestLogger)

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Setup API routes
setupRoutes(app)

// Error handling middleware (must be last)
app.use(errorSanitizer)

// Initialize Socket.IO
const io = initializeSocketIO(httpServer)

// Start server with error handling
httpServer.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`)
  console.log(`📡 Socket.IO ready for realtime communication`)
  console.log(`🌍 CORS enabled for: ${corsOptions.origin}`)
}).on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please use a different port.`)
    process.exit(1)
  } else {
    console.error('❌ Server error:', error)
    process.exit(1)
  }
})

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🔄 Shutting down gracefully...')
  
  // Close HTTP server
  httpServer.close(() => {
    console.log('✅ HTTP server closed')
  })
  
  // Close all Socket.IO connections
  if (io) {
    io.close(() => {
      console.log('✅ Socket.IO connections closed')
    })
  }
  
  // Exit after cleanup
  setTimeout(() => {
    console.log('✅ Shutdown complete')
    process.exit(0)
  }, 1000)
}

// Handle shutdown signals
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  shutdown()
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  shutdown()
})

export { app, httpServer, io }

