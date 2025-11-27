import { Router, Request, Response } from 'express'
import { createClient } from '@deepgram/sdk'

const router = Router()

/**
 * GET endpoint to get Deepgram WebSocket connection details
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY

    if (!apiKey) {
      return res.status(500).json({ error: 'Deepgram API key not configured' })
    }

    const language = (req.query.language as string) || 'en-US'
    const model = (req.query.model as string) || 'nova-2'
    const diarize = req.query.diarize === 'true'

    const params = new URLSearchParams({
      model,
      language,
      punctuate: 'true',
      diarize: String(diarize),
      smart_format: 'true',
      interim_results: 'false',
      endpointing: '200',
      vad_events: 'true',
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
})

/**
 * POST endpoint to get Deepgram WebSocket connection details
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY

    if (!apiKey) {
      return res.status(500).json({ error: 'Deepgram API key not configured' })
    }

    const { language = 'en-US', model = 'nova-2', diarize = false } = req.body

    const params = new URLSearchParams({
      model,
      language,
      punctuate: 'true',
      diarize: String(diarize),
      smart_format: 'true',
      interim_results: 'false',
      endpointing: '200',
      vad_events: 'true',
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
})

export { router as deepgramRouter }

