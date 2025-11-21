/**
 * Deepgram Service for Real-time Speech Recognition
 * Provides better accuracy than Web Speech API
 * 
 * This service handles both live transcription and pre-recorded audio transcription
 * using the Deepgram SDK v4
 */

import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'

export interface DeepgramConfig {
  apiKey: string
  language?: string
  model?: string
  punctuate?: boolean
  diarize?: boolean
  smart_format?: boolean
}

export class DeepgramService {
  private client: ReturnType<typeof createClient> | null = null
  private apiKey: string | null = null

  /**
   * Initialize the Deepgram client with an API key
   */
  initialize(apiKey: string) {
    if (!apiKey) {
      throw new Error('Deepgram API key is required')
    }
    this.apiKey = apiKey
    this.client = createClient(apiKey)
  }

  /**
   * Get the initialized Deepgram client
   */
  getClient() {
    if (!this.client) {
      throw new Error('Deepgram client not initialized. Call initialize() first.')
    }
    return this.client
  }

  /**
   * Get WebSocket URL for real-time transcription
   * Note: This URL should be used with proper authentication headers
   */
  getWebSocketUrl(config: DeepgramConfig): string {
    if (!this.apiKey) {
      throw new Error('Deepgram API key not set')
    }

    const params = new URLSearchParams({
      model: config.model || 'nova-2',
      language: config.language || 'en-US',
      punctuate: String(config.punctuate !== false),
      diarize: String(config.diarize === true), // Speaker diarization
      smart_format: String(config.smart_format !== false),
      interim_results: 'true',
      endpointing: '300', // Endpointing timeout in ms
      vad_events: 'true', // Voice activity detection events
      encoding: 'linear16',
      sample_rate: '16000',
      channels: '1',
    })

    return `wss://api.deepgram.com/v1/listen?${params.toString()}`
  }

  /**
   * Create a live transcription connection using the SDK
   * This is the recommended way to handle live transcription
   */
  async createLiveTranscription(config: DeepgramConfig) {
    const client = this.getClient()
    
    const connection = client.listen.live({
      model: config.model || 'nova-2',
      language: config.language || 'en-US',
      punctuate: config.punctuate !== false,
      diarize: config.diarize === true,
      smart_format: config.smart_format !== false,
      interim_results: true,
      endpointing: 300,
      vad_events: true,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1,
    })

    return connection
  }

  /**
   * Create a transcription request for pre-recorded audio
   */
  async transcribeAudio(audioBuffer: Buffer, config: DeepgramConfig) {
    const client = this.getClient()
    
    const { result, error } = await client.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: config.model || 'nova-2',
        language: config.language || 'en-US',
        punctuate: config.punctuate !== false,
        diarize: config.diarize === true,
        smart_format: config.smart_format !== false,
      }
    )

    if (error) {
      throw new Error(`Deepgram transcription error: ${error.message}`)
    }

    return result
  }
}

export const deepgramService = new DeepgramService()

