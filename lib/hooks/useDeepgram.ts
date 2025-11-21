'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { TranscriptEntry } from '@/lib/store'
import { speakerDetectionService } from '@/lib/speakerDetection'

export interface DeepgramTranscript {
  transcript: string
  is_final: boolean
  confidence: number
  words?: Array<{
    word: string
    start: number
    end: number
    confidence: number
    speaker?: number | string
    punctuated_word?: string
  }>
  paragraphs?: {
    paragraphs?: Array<{
      speaker?: number | string
      transcript?: string
      sentences?: Array<{ text: string }>
    }>
  }
  speaker?: number | string // Speaker ID if diarization is enabled
}

export function useDeepgram() {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5
  const lastSpeakerRef = useRef<'interviewer' | 'applicant'>('interviewer')
  const speakerRoleMapRef = useRef<Record<string, 'interviewer' | 'applicant'>>({})

  const connect = useCallback(async (language: string = 'en-US', onTranscript: (entry: TranscriptEntry) => void) => {
    try {
      // Get Deepgram WebSocket URL from API with diarization enabled
      const response = await fetch(
        `/api/deepgram?language=${encodeURIComponent(language)}&diarize=true`
      )
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to get Deepgram connection URL')
      }

      const { wsUrl, apiKey } = await response.json()
      
      if (!wsUrl || !apiKey) {
        throw new Error('No WebSocket URL or API key returned from server')
      }

      // Reset speaker tracking for a clean session
      speakerRoleMapRef.current = {}
      lastSpeakerRef.current = 'interviewer'
      speakerDetectionService.resetHistory()

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000, // Deepgram recommended sample rate
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      mediaStreamRef.current = stream

      // Create AudioContext for processing
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      // OPTIMIZED: Smaller buffer (2048 instead of 4096) for lower latency
      const processor = audioContext.createScriptProcessor(2048, 1, 1)

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0)
          // Convert Float32Array to Int16Array for Deepgram
          const int16Data = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            // Clamp and convert to 16-bit PCM
            const s = Math.max(-1, Math.min(1, inputData[i]))
            int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }
          // Send audio data to Deepgram
          wsRef.current.send(int16Data.buffer)
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)
      processorRef.current = processor

      // Connect to Deepgram WebSocket with proper authentication
      // Create WebSocket with Authorization header using protocols parameter
      const ws = new WebSocket(wsUrl, ['token', apiKey])

      ws.onopen = () => {
        console.log('Deepgram WebSocket connected')
        setIsConnected(true)
        setError(null)
        reconnectAttemptsRef.current = 0
      }

      const resolveSpeakerRole = (
        speakerId: string | number | undefined,
        text: string,
        confidence?: number
      ): 'interviewer' | 'applicant' => {
        const fallback = speakerDetectionService.detectSpeaker(
          text,
          lastSpeakerRef.current,
          confidence
        ).speaker

        if (speakerId === undefined || speakerId === null) {
          return fallback
        }

        const key = String(speakerId)
        const existing = speakerRoleMapRef.current[key]
        if (existing) {
          return existing
        }

        const assignedRoles = new Set(Object.values(speakerRoleMapRef.current))
        let role: 'interviewer' | 'applicant' = fallback

        if (assignedRoles.has(role)) {
          const alternativeRole: 'interviewer' | 'applicant' =
            role === 'interviewer' ? 'applicant' : 'interviewer'
          if (!assignedRoles.has(alternativeRole)) {
            role = alternativeRole
          }
        }

        speakerRoleMapRef.current[key] = role
        return role
      }

      const buildSegments = (alternative: any, fallbackTranscript: string) => {
        type Segment = { speakerId?: string; text: string }
        const segments: Segment[] = []

        const paragraphSegments = alternative?.paragraphs?.paragraphs
        if (Array.isArray(paragraphSegments) && paragraphSegments.length > 0) {
          paragraphSegments.forEach((paragraph: any) => {
            const text =
              paragraph?.transcript ||
              (Array.isArray(paragraph?.sentences)
                ? paragraph.sentences.map((s: any) => s.text).join(' ')
                : '')

            if (text && text.trim().length > 0) {
              segments.push({
                speakerId:
                  paragraph?.speaker !== undefined ? String(paragraph.speaker) : undefined,
                text: text.trim(),
              })
            }
          })

          if (segments.length > 0) {
            return segments
          }
        }

        const words = alternative?.words
        if (Array.isArray(words) && words.length > 0) {
          let currentSpeakerId: string | undefined =
            words[0]?.speaker !== undefined ? String(words[0].speaker) : undefined
          let buffer: string[] = []

          words.forEach((word: any) => {
            const wordSpeakerId =
              word?.speaker !== undefined ? String(word.speaker) : undefined
            const token = word?.punctuated_word || word?.word || ''
            if (!token) {
              return
            }

            if (wordSpeakerId !== currentSpeakerId && buffer.length > 0) {
              segments.push({
                speakerId: currentSpeakerId,
                text: buffer.join(' ').trim(),
              })
              buffer = []
              currentSpeakerId = wordSpeakerId
            }

            buffer.push(token)
          })

          if (buffer.length > 0) {
            segments.push({
              speakerId: currentSpeakerId,
              text: buffer.join(' ').trim(),
            })
          }

          if (segments.length === 1 && segments[0].speakerId) {
            segments[0].text = fallbackTranscript.trim()
          }

          return segments.filter((segment) => segment.text.length > 0)
        }

        return [
          {
            speakerId: alternative?.speaker !== undefined ? String(alternative.speaker) : undefined,
            text: fallbackTranscript.trim(),
          },
        ]
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.channel?.alternatives?.[0]) {
            const alternative = data.channel.alternatives[0]
            const transcript = alternative.transcript || ''
            const isFinal = data.is_final || false
            const confidence = alternative.confidence || 0

            if (transcript.trim() && isFinal) {
              const segments = buildSegments(alternative, transcript)
              segments.forEach((segment: { speakerId?: string; text: string }) => {
                const text = segment.text.trim()
                if (!text) {
                  return
                }

                const role = resolveSpeakerRole(segment.speakerId, text, confidence)
                lastSpeakerRef.current = role

                const entry: TranscriptEntry = {
                  id: `deepgram-${Date.now()}-${Math.random()}`,
                  speaker: role,
                  text,
                  timestamp: Date.now(),
                }

                onTranscript(entry)
              })
            }
          }
        } catch (err) {
          console.error('Error parsing Deepgram message:', err)
        }
      }

      ws.onerror = (error) => {
        console.error('Deepgram WebSocket error:', error)
        setError('Connection error. Please check your API key and try again.')
        setIsConnected(false)
      }

      ws.onclose = (event) => {
        console.log('Deepgram WebSocket closed:', event.code, event.reason)
        setIsConnected(false)

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 5000)
          console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current})`)
          setTimeout(() => {
            connect(language, onTranscript)
          }, delay)
        }
      }

      wsRef.current = ws
    } catch (err: any) {
      console.error('Failed to connect to Deepgram:', err)
      setError(err.message || 'Failed to connect to Deepgram')
      setIsConnected(false)
      
      // Cleanup on error
      disconnect()
    }
  }, [])

  const disconnect = useCallback(() => {
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    // Stop audio processing
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    // Stop audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error)
      audioContextRef.current = null
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    // Reset speaker tracking
    lastSpeakerRef.current = 'interviewer'
    speakerRoleMapRef.current = {}
    speakerDetectionService.resetHistory()

    setIsConnected(false)
  }, [])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    connect,
    disconnect,
    isConnected,
    error,
  }
}

