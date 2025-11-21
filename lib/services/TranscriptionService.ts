/**
 * Transcription Service
 * Handles all speech-to-text operations with Deepgram
 * Separated from UI logic for better testability and reusability
 */

import { TranscriptEntry } from '../store'

export interface TranscriptionConfig {
  language: string
  model?: string
  diarize?: boolean
  punctuate?: boolean
  smartFormat?: boolean
}

export type TranscriptionCallback = (entry: TranscriptEntry) => void

export interface ITranscriptionService {
  initialize(config: TranscriptionConfig): Promise<void>
  start(onTranscript: TranscriptionCallback): Promise<void>
  stop(): Promise<void>
  isActive(): boolean
  updateLanguage(language: string): void
}

export class DeepgramTranscriptionService implements ITranscriptionService {
  private wsConnection: WebSocket | null = null
  private mediaStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private config: TranscriptionConfig
  private isActiveState: boolean = false
  private onTranscriptCallback: TranscriptionCallback | null = null

  constructor(config: TranscriptionConfig) {
    this.config = config
  }

  async initialize(config: TranscriptionConfig): Promise<void> {
    this.config = { ...this.config, ...config }
  }

  async start(onTranscript: TranscriptionCallback): Promise<void> {
    if (this.isActiveState) {
      console.warn('Transcription already active')
      return
    }

    this.onTranscriptCallback = onTranscript
    
    try {
      // Get Deepgram WebSocket URL from API
      const response = await fetch(
        `/api/deepgram?language=${encodeURIComponent(this.config.language)}&diarize=true`
      )
      
      if (!response.ok) {
        throw new Error('Failed to initialize Deepgram connection')
      }

      const { wsUrl, apiKey } = await response.json()
      
      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // Create audio processing pipeline
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      })

      const source = this.audioContext.createMediaStreamSource(this.mediaStream)
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)

      // Connect to Deepgram WebSocket
      this.wsConnection = new WebSocket(wsUrl, ['token', apiKey])
      
      this.setupWebSocketHandlers()
      this.setupAudioProcessing(source)
      
      this.isActiveState = true
    } catch (error) {
      console.error('Failed to start transcription:', error)
      await this.stop()
      throw error
    }
  }

  async stop(): Promise<void> {
    this.isActiveState = false
    this.onTranscriptCallback = null

    // Close WebSocket
    if (this.wsConnection) {
      this.wsConnection.close()
      this.wsConnection = null
    }

    // Stop audio processing
    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }

    // Close audio context
    if (this.audioContext) {
      await this.audioContext.close()
      this.audioContext = null
    }

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }
  }

  isActive(): boolean {
    return this.isActiveState
  }

  updateLanguage(language: string): void {
    this.config.language = language
  }

  private setupWebSocketHandlers(): void {
    if (!this.wsConnection) return

    this.wsConnection.onopen = () => {
      console.log('Deepgram WebSocket connected')
    }

    this.wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.channel?.alternatives?.[0]) {
          const alternative = data.channel.alternatives[0]
          const transcript = alternative.transcript || ''
          const isFinal = data.is_final || false

          if (transcript.trim() && isFinal && this.onTranscriptCallback) {
            const entry: TranscriptEntry = {
              id: `transcript-${Date.now()}-${Math.random()}`,
              speaker: this.detectSpeaker(transcript),
              text: transcript.trim(),
              timestamp: Date.now(),
            }
            
            this.onTranscriptCallback(entry)
          }
        }
      } catch (error) {
        console.error('Error parsing Deepgram message:', error)
      }
    }

    this.wsConnection.onerror = (error) => {
      console.error('Deepgram WebSocket error:', error)
    }

    this.wsConnection.onclose = () => {
      console.log('Deepgram WebSocket closed')
    }
  }

  private setupAudioProcessing(source: MediaStreamAudioSourceNode): void {
    if (!this.processor || !this.audioContext) return

    this.processor.onaudioprocess = (e) => {
      if (this.wsConnection?.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0)
        const int16Data = new Int16Array(inputData.length)
        
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }
        
        this.wsConnection.send(int16Data.buffer)
      }
    }

    source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)
  }

  private detectSpeaker(text: string): 'interviewer' | 'applicant' | 'system' {
    // Basic detection - will be enhanced by SpeakerDetectionService
    const hasQuestion = text.includes('?') || 
      /\b(what|why|how|when|where|who|tell me|describe)\b/i.test(text)
    
    return hasQuestion ? 'interviewer' : 'applicant'
  }
}

