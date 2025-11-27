/**
 * Deepgram Service for Real-time Speech Recognition
 * Frontend client that connects to Deepgram via WebSocket
 * API key is obtained from the backend for security
 */

export interface DeepgramConfig {
  apiKey: string
  language?: string
  model?: string
  punctuate?: boolean
  diarize?: boolean
  smart_format?: boolean
}

export class DeepgramService {
  private apiKey: string | null = null

  /**
   * Initialize with API key from backend
   */
  initialize(apiKey: string) {
    if (!apiKey) {
      throw new Error('Deepgram API key is required')
    }
    this.apiKey = apiKey
  }

  /**
   * Get WebSocket URL for real-time transcription
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
   * Create a WebSocket connection for live transcription
   */
  createWebSocket(config: DeepgramConfig): WebSocket {
    const url = this.getWebSocketUrl(config)
    const socket = new WebSocket(url, ['token', this.apiKey!])
    return socket
  }

  /**
   * Get API key (for authorization headers)
   */
  getApiKey(): string {
    if (!this.apiKey) {
      throw new Error('API key not initialized')
    }
    return this.apiKey
  }
}

export const deepgramService = new DeepgramService()

