import { Server as HTTPServer } from 'node:http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { langchainService } from '../services/langchainService'
import { Turn } from '../types'

let io: SocketIOServer | null = null

// Track active generations per socket for cancellation
const activeGenerations = new Map<string, number>()

export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
  if (io) return io

  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:3000']

  io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6,
    connectTimeout: 45000,
  })

  io.on('connection', (socket: Socket) => {
    console.log('✅ Client connected:', socket.id)
    activeGenerations.set(socket.id, -1)

    socket.on('analyze:stream', async (data) => {
      const { turns, utteranceText, language, interviewContext, simpleEnglish, aiModel, generationId } = data

      try {
        if (!utteranceText || typeof utteranceText !== 'string') {
          socket.emit('analyze:error', { error: 'Invalid utterance text', generationId })
          return
        }

        // Set active generation for this socket
        activeGenerations.set(socket.id, generationId ?? Date.now())
        const currentGeneration = activeGenerations.get(socket.id)!

        console.log(`[Socket ${socket.id}] Starting analysis (gen ${currentGeneration})`)

        const validTurns: Turn[] = Array.isArray(turns) ? turns.slice(-6) : []
        let fullResponse = ''

        for await (const chunk of langchainService.streamAnalysis(
          validTurns,
          utteranceText,
          language || 'en',
          interviewContext || {},
          simpleEnglish || false,
          aiModel || 'gpt-4o-mini'
        )) {
          // Check if generation is still valid (not cancelled)
          if (activeGenerations.get(socket.id) !== currentGeneration) {
            console.log(`[Socket ${socket.id}] Generation ${currentGeneration} cancelled, stopping stream`)
            break
          }

          fullResponse += chunk
          socket.emit('analyze:chunk', { chunk, generationId: currentGeneration })
        }

        // Only emit complete if generation is still valid
        if (activeGenerations.get(socket.id) === currentGeneration) {
          socket.emit('analyze:complete', {
            result: { answer: fullResponse.trim() },
            generationId: currentGeneration,
          })
          console.log(`[Socket ${socket.id}] Analysis complete (gen ${currentGeneration})`)
        }
      } catch (error) {
        console.error('Streaming error:', error)
        socket.emit('analyze:error', {
          error: error instanceof Error ? error.message : 'Analysis failed',
          generationId: data.generationId,
        })
      }
    })

    // Handle cancellation
    socket.on('analyze:cancel', (data) => {
      const { generationId } = data || {}
      const currentGeneration = activeGenerations.get(socket.id)
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Socket ${socket.id}] Cancel requested (gen ${generationId}, current: ${currentGeneration})`)
      }
      
      // Only cancel if the generation ID matches or if no specific generation provided
      if (generationId === undefined || generationId === currentGeneration) {
        activeGenerations.set(socket.id, -1)
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Socket ${socket.id}] Generation ${generationId} cancelled`)
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Socket ${socket.id}] Ignoring cancel for stale generation ${generationId}`)
        }
      }
    })

    socket.on('disconnect', (reason) => {
      console.log('❌ Client disconnected:', socket.id, reason)
      activeGenerations.delete(socket.id)
      socket.removeAllListeners()
    })

    socket.on('error', (error) => {
      console.error('❌ Socket error:', error)
      activeGenerations.delete(socket.id)
      socket.removeAllListeners()
      socket.disconnect(true)
    })
  })

  return io
}

export function getSocketIO(): SocketIOServer | null {
  return io
}
