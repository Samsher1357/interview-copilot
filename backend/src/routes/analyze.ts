import { Router, Request, Response } from 'express'
import { langchainService } from '../services/langchainService'
import { TranscriptEntry } from '../types'
import { apiLimiter } from '../middleware/rateLimiter'

const router = Router()

// Apply rate limiting to analysis endpoint
router.use(apiLimiter)

// Non-streaming analysis endpoint
router.post('/', async (req: Request, res: Response) => {
  try {
    const { transcripts, language, interviewContext = {}, aiModel = 'gpt-4o-mini' } = req.body

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

    // Validate language
    if (language && typeof language !== 'string') {
      return res.status(400).json({ error: 'Language must be a string' })
    }

    const analysis = await langchainService.analyzeConversation(
      transcripts as TranscriptEntry[],
      language || 'en',
      interviewContext,
      aiModel
    )

    const answerResponse = analysis.find(r => r.type === 'answer')
    const suggestionResponse = analysis.find(r => r.type === 'suggestion')
    const hintResponse = analysis.find(r => r.type === 'hint')
    const talkingPointResponse = analysis.find(r => r.type === 'talking-point')

    const content = {
      intent: 'general',
      context: '',
      answer: answerResponse?.content || '',
      suggestions: suggestionResponse ? [suggestionResponse.content] : [],
      hints: hintResponse ? [hintResponse.content] : [],
      talkingPoints: talkingPointResponse ? [talkingPointResponse.content] : [],
    }

    res.json({
      intent: content.intent || 'general',
      context: content.context || '',
      answer: content.answer || '',
      suggestions: content.suggestions || [],
      hints: content.hints || [],
      talkingPoints: content.talkingPoints || [],
    })
  } catch (error) {
    console.error('API route error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: errorMessage })
  }
})

export { router as analyzeRouter }

