import { Router, Request, Response } from 'express'
import { validateQuery } from '../middleware/validation'
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

      // Return API key for SDK initialization on the frontend
      // The SDK handles connection configuration internally
      res.json({
        apiKey,
      })
    } catch (error: any) {
      console.error('Deepgram API error:', error)
      res.status(500).json({ error: error.message || 'Failed to initialize Deepgram connection' })
    }
  }
)

export { router as deepgramRouter }

