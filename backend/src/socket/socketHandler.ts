import { Server as HTTPServer } from 'node:http'
import { Server as SocketIOServer } from 'socket.io'
import { langchainService } from '../services/langchainService'
import { TranscriptEntry } from '../types'

let io: SocketIOServer | null = null

export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io
  }

  // Support multiple origins for Railway deployment
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
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

  io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id)
    
    let currentAnalysisAborted = false

    // Handle streaming analysis
    socket.on('analyze:stream', async (data) => {
      const { transcripts, interviewContext, simpleEnglish, aiModel } = data
      
      // Reset abort flag for new analysis
      currentAnalysisAborted = false

      try {
        if (!transcripts || !Array.isArray(transcripts) || transcripts.length === 0) {
          socket.emit('analyze:error', { error: 'Invalid transcripts' })
          return
        }
        
        if (!socket.connected) {
          console.log('Socket disconnected before analysis started')
          return
        }

        const trimmedTranscripts = (transcripts as TranscriptEntry[]).slice(-8)
        let fullResponse = ''

        for await (const chunk of langchainService.streamAnalysis(
          trimmedTranscripts,
          interviewContext || {},
          simpleEnglish || false,
          aiModel || 'gpt-4o-mini'
        )) {
          // Check if client disconnected or analysis was aborted
          if (currentAnalysisAborted || !socket.connected) {
            console.log('Analysis aborted - client disconnected')
            return
          }
          
          fullResponse += chunk
          socket.emit('analyze:chunk', { chunk })
        }
        
        // Final check before sending complete
        if (currentAnalysisAborted || !socket.connected) {
          console.log('Analysis aborted before completion')
          return
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
        if (socket.connected && !currentAnalysisAborted) {
          const errorMessage = error instanceof Error ? error.message : 'Analysis failed'
          socket.emit('analyze:error', { error: errorMessage })
        }
      }
    })

    socket.on('disconnect', (reason) => {
      console.log('❌ Client disconnected:', socket.id, reason)
      // Set abort flag to stop any ongoing analysis
      currentAnalysisAborted = true
      // Clean up all listeners on disconnect
      socket.removeAllListeners()
    })

    socket.on('error', (error) => {
      console.error('❌ Socket error:', error)
      currentAnalysisAborted = true
      socket.removeAllListeners()
      socket.disconnect(true)
    })
  })

  return io
}

export function getSocketIO(): SocketIOServer | null {
  return io
}

