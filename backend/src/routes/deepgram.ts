import { Router, Request, Response } from 'express'
import { validateQuery, validateBody } from '../middleware/validation'
import { apiLimiter } from '../middleware/rateLimiter'

const router = Router()

/**
 * GET endpoint to get Deepgram WebSocket connection details
 */
router.get(
  '/',
  apiLimiter,
  validateQuery({
    language: {
      required: false,
      type: 'string',
    },
    model: {
      required: false,
      type: 'string',
    },
    diarize: {
      required: false,
      type: 'boolean',
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.DEEPGRAM_API_KEY

      if (!apiKey) {
        return res.status(500).json({ error: 'Deepgram API key not configured' })
      }

      const language = (req.query.language as string) || 'en-US'
      const model = (req.query.model as string) || 'nova-3'
      const diarize = req.query.diarize === 'true'

      // Nova 3 optimized for real-time interviews
      const params = new URLSearchParams({
        model,
        language,
        punctuate: 'true',
        diarize: String(diarize),
        smart_format: 'true',
        interim_results: 'true', // Enable for real-time feedback
        utterance_end_ms: '1000', // 1 second silence = end of utterance
        vad_events: 'true', // Voice activity detection
        filler_words: 'true', // Detect "um", "uh" for interview analysis
        encoding: 'linear16',
        sample_rate: '16000',
        channels: '1',
      })

      const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`

      res.json({
        wsUrl,
        apiKey,
      })
    } catch (error: any) {
      console.error('Deepgram API error:', error)
      res.status(500).json({ error: error.message || 'Failed to initialize Deepgram connection' })
    }
  }
)

/**
 * POST endpoint to get Deepgram WebSocket connection details
 */
router.post(
  '/',
  apiLimiter,
  validateBody({
    language: {
      required: false,
      type: 'string',
    },
    model: {
      required: false,
      type: 'string',
    },
    diarize: {
      required: false,
      type: 'boolean',
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.DEEPGRAM_API_KEY

      if (!apiKey) {
        return res.status(500).json({ error: 'Deepgram API key not configured' })
      }

      const { language = 'en-US', model = 'nova-3', diarize = false } = req.body

      // Nova 3 optimized for real-time interviews
      const params = new URLSearchParams({
        model,
        language,
        punctuate: 'true',
        diarize: String(diarize),
        smart_format: 'true',
        interim_results: 'true', // Enable for real-time feedback
        utterance_end_ms: '1000', // 1 second silence = end of utterance
        vad_events: 'true', // Voice activity detection
        filler_words: 'true', // Detect "um", "uh" for interview analysis
        encoding: 'linear16',
        sample_rate: '16000',
        channels: '1',
      })

      const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`

      res.json({
        wsUrl,
        apiKey,
      })
    } catch (error: any) {
      console.error('Deepgram API error:', error)
      res.status(500).json({ error: error.message || 'Failed to initialize Deepgram connection' })
    }
  }
)

export { router as deepgramRouter }

