'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { TranscriptEntry } from '@/lib/store'
import { retryWithBackoff } from '@/lib/utils/retryWithBackoff'

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_BASE_DELAY = 1000

export function useDeepgram() {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [interimTranscript, setInterimTranscript] = useState<string>('')

  const wsRef = useRef<WebSocket | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const connectingRef = useRef(false)
  const shouldReconnectRef = useRef(true)

  const transcriptBufferRef = useRef('')

  const cleanup = () => {
    // PRIORITY 1: Stop microphone immediately (this removes browser mic indicator)
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      mediaStreamRef.current = null
    }

    // PRIORITY 2: Close WebSocket to stop data flow
    if (wsRef.current) {
      wsRef.current.close(1000, 'User stopped recording') // Clean close
      wsRef.current = null
    }

    // PRIORITY 3: Disconnect audio processing
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.disconnect()
        workletNodeRef.current = null
      } catch (error) {
        // Worklet might already be disconnected
        workletNodeRef.current = null
      }
    }

    // PRIORITY 4: Close audio context
    if (audioContextRef.current) {
      // Try synchronous close first for immediate effect
      if (audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close().catch(() => {})
        } catch (error) {
          // Context might already be closing
        }
      }
      audioContextRef.current = null
    }

    // Clear buffer states
    transcriptBufferRef.current = ''
  }

  const disconnect = useCallback(() => {
    // Immediately stop any reconnection attempts
    shouldReconnectRef.current = false
    connectingRef.current = false
    
    cleanup()
    setIsConnected(false)
    setError(null)
    setInterimTranscript('')
  }, [])

  const connect = useCallback(
    async (language: string = 'en-US', onTranscript: (entry: TranscriptEntry) => void) => {
      if (connectingRef.current || wsRef.current) return
      connectingRef.current = true
      setError(null)

      try {
        cleanup()
        shouldReconnectRef.current = true
        reconnectAttemptsRef.current = 0

        transcriptBufferRef.current = ''

        const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        
        // Use retry logic for fetching Deepgram connection
        const { wsUrl, apiKey } = await retryWithBackoff(
          async () => {
            const res = await fetch(`${api}/api/deepgram?language=${language}&diarize=false`)
            if (!res.ok) {
              throw new Error(`Failed to fetch Deepgram connection: ${res.status}`)
            }
            return res.json()
          },
          {
            maxRetries: 3,
            initialDelayMs: 1000,
            onRetry: (attempt, error) => {
              console.log(`Retrying Deepgram connection (attempt ${attempt}):`, error)
              setError(`Connecting... (attempt ${attempt})`)
            },
          }
        )

        // mic
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
        })
        mediaStreamRef.current = stream

        // audio ctx
        const ctx = new AudioContext({ sampleRate: 16000 })
        audioContextRef.current = ctx

        await ctx.audioWorklet.addModule('/worklets/pcm-encoder.js')
        const worklet = new AudioWorkletNode(ctx, 'pcm-encoder')
        const source = ctx.createMediaStreamSource(stream)
        source.connect(worklet)
        workletNodeRef.current = worklet

        // ws
        const ws = new WebSocket(wsUrl, ['token', apiKey])
        wsRef.current = ws

        ws.onopen = () => {
          setIsConnected(true)
          setError(null)
          reconnectAttemptsRef.current = 0
          connectingRef.current = false
        }

        worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(e.data)
        }

        const flushTranscript = () => {
          // Emit buffered utterances once Deepgram finishes an utterance.
          const utterance = transcriptBufferRef.current.trim()
          if (!utterance) return

          onTranscript({
            id: crypto.randomUUID(),
            text: utterance,
            speaker: 'user', // All transcripts are from the user/candidate
            timestamp: Date.now(),
          })

          transcriptBufferRef.current = ''
        }

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data)
            
            // Handle interim results for real-time display
            if (data.type === 'Results') {
              const alt = data.channel?.alternatives?.[0]
              if (!alt) return

              const text = alt.transcript?.trim()
              if (!text) return

              // Show interim results in real-time
              if (!data.is_final) {
                setInterimTranscript(text)
                return
              }

              // Clear interim when we get final
              setInterimTranscript('')

              // Only process final results for transcript buffer
              if (data.is_final) {
                if (!transcriptBufferRef.current) {
                  transcriptBufferRef.current = text
                } else {
                  const existing = transcriptBufferRef.current
                  const normalizedExisting = existing.replace(/\s+/g, ' ').trim()
                  const normalizedIncoming = text.replace(/\s+/g, ' ').trim()

                  if (normalizedIncoming.startsWith(normalizedExisting)) {
                    transcriptBufferRef.current = text
                  } else if (!normalizedExisting.startsWith(normalizedIncoming)) {
                    transcriptBufferRef.current = `${existing} ${text}`.trim()
                  }
                }
              }

              // Flush on speech_final (end of utterance)
              if (data.speech_final) {
                flushTranscript()
              }
            }
          } catch {}
        }

        ws.onerror = () => {
          setError('WebSocket error')
        }

        ws.onclose = () => {
          setIsConnected(false)
          flushTranscript()
          cleanup()
          connectingRef.current = false

          // Exponential backoff for reconnection
          if (shouldReconnectRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current++
            const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1)
            setError(`Reconnecting... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`)
            setTimeout(() => connect(language, onTranscript), delay)
          } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            setError('Failed to reconnect after multiple attempts')
          }
        }
      } catch (err: any) {
        setError(err.message || 'Connection failed')
        cleanup()
        connectingRef.current = false
        setIsConnected(false)
      }
    },
    []
  )

  useEffect(() => disconnect, [disconnect])

  return { connect, disconnect, isConnected, error, interimTranscript }
}