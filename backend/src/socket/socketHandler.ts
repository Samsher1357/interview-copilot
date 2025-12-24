import { Server as HTTPServer } from 'node:http'
import { Server as SocketIOServer } from 'socket.io'
import { langchainService } from '../services/langchainService'
import { TranscriptEntry } from '../types'

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
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6,
    connectTimeout: 45000,
  })

  io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id)

    // Handle streaming analysis
    socket.on('analyze:stream', async (data) => {
      const { transcripts, language, interviewContext, simpleEnglish, aiModel } = data

      try {
        if (!transcripts || !Array.isArray(transcripts) || transcripts.length === 0) {
          socket.emit('analyze:error', { error: 'Invalid transcripts' })
          return
        }

        const trimmedTranscripts = (transcripts as TranscriptEntry[]).slice(-8)
        let fullResponse = ''

        for await (const chunk of langchainService.streamAnalysis(
          trimmedTranscripts,
          language || 'en',
          interviewContext || {},
          simpleEnglish || false,
          aiModel || 'gpt-4o-mini'
        )) {
          fullResponse += chunk
          socket.emit('analyze:chunk', { chunk })
        }

        const parsed = {
          intent: 'general',
          context: 'Streamed response',
          answer: fullResponse.trim(),
          suggestions: [],
          hints: [],
          talkingPoints: [],
        }

        socket.emit('analyze:complete', { result: parsed })
      } catch (error) {
        console.error('Streaming error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Analysis failed'
        socket.emit('analyze:error', { error: errorMessage })
      }
    })

    socket.on('disconnect', (reason) => {
      console.log('❌ Client disconnected:', socket.id, reason)
    })

    socket.on('error', (error) => {
      console.error('❌ Socket error:', error)
      socket.disconnect(true)
    })
  })

  return io
}

export function getSocketIO(): SocketIOServer | null {
  return io
}

