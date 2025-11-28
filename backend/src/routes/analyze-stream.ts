import { Router, Request, Response } from 'express'
import { langchainService } from '../services/langchainService'
import { TranscriptEntry } from '../types'
import { streamLimiter } from '../middleware/rateLimiter'

const router = Router()
const MAX_TRANSCRIPTS_FOR_ANALYSIS = 8 // Optimized for faster processing

// Apply rate limiting to streaming endpoint
router.use(streamLimiter)

// Streaming analysis endpoint
router.post('/', async (req: Request, res: Response) => {
  try {
    const { transcripts, language, interviewContext = {}, simpleEnglish = false, aiModel = 'gpt-4o-mini' } = req.body

    // Validate input
    if (!transcripts || !Array.isArray(transcripts)) {
      return res.status(400).json({ error: 'Transcripts must be an array' })
    }

    if (transcripts.length === 0) {
      return res.status(400).json({ error: 'No transcripts provided' })
    }

    // Validate transcript structure
    const validTranscripts = transcripts.every((t: any) => 
      t && typeof t === 'object' && 
      typeof t.text === 'string' && 
      typeof t.speaker === 'string'
    )

    if (!validTranscripts) {
      return res.status(400).json({ error: 'Invalid transcript format' })
    }

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering

    // Set timeout to 60 seconds
    req.setTimeout(60000)

    // Handle client disconnect
    req.on('close', () => {
      console.log('Client disconnected from stream')
    })

    const trimmedTranscripts = (transcripts as TranscriptEntry[]).slice(-MAX_TRANSCRIPTS_FOR_ANALYSIS)
    let fullResponse = ''
    let buffer = ''
    let lastSendTime = Date.now()

    try {
      for await (const chunk of langchainService.streamAnalysis(
        trimmedTranscripts,
        language || 'en',
        interviewContext,
        simpleEnglish,
        aiModel
      )) {
        fullResponse += chunk
        buffer += chunk

        const now = Date.now()
        const timeSinceLastSend = now - lastSendTime

        // Optimized buffering strategy for real-time feel
        const shouldSend =
          buffer.length >= 5 || // Smaller buffer for faster updates
          (buffer.includes(' ') && buffer.length >= 2) ||
          buffer.includes('\n') ||
          /[.!?]/.test(buffer) || // Sentence boundaries
          timeSinceLastSend >= 50 // Maximum 50ms delay

        if (shouldSend && buffer.trim().length > 0) {
          res.write(`data: ${JSON.stringify({ chunk: buffer, done: false })}\n\n`)
          buffer = ''
          lastSendTime = now
        }
      }

      if (buffer.trim().length > 0) {
        res.write(`data: ${JSON.stringify({ chunk: buffer, done: false })}\n\n`)
      }

      const parsed = {
        intent: 'general',
        context: 'Streamed response',
        answer: fullResponse.trim(),
        suggestions: [],
        hints: [],
        talkingPoints: [],
      }

      res.write(`data: ${JSON.stringify({ result: parsed, done: true })}\n\n`)
      res.end()
    } catch (error) {
      console.error('Streaming error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Internal server error'
      res.write(`data: ${JSON.stringify({ error: errorMessage, done: true })}\n\n`)
      res.end()
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: errorMessage })
  }
})

export { router as analyzeStreamRouter }

