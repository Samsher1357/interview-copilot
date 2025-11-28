'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { TranscriptEntry } from '@/lib/store'
import { speakerDetectionService } from '@/lib/speakerDetection'

export function useDeepgram() {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const connectingRef = useRef(false)
  const shouldReconnectRef = useRef(true)

  const lastSpeakerRef = useRef<'interviewer' | 'applicant'>('interviewer')
  const speakerRoleMapRef = useRef<Record<string, 'interviewer' | 'applicant'>>({})
  const transcriptBufferRef = useRef('')
  const currentSpeakerIdRef = useRef<string | null>(null)

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
    currentSpeakerIdRef.current = null
  }

  const disconnect = useCallback(() => {
    // Immediately stop any reconnection attempts
    shouldReconnectRef.current = false
    connectingRef.current = false
    
    cleanup()
    setIsConnected(false)
    setError(null)
  }, [])

  const connect = useCallback(
    async (language: string = 'en-US', onTranscript: (entry: TranscriptEntry) => void) => {
      if (connectingRef.current || wsRef.current) return
      connectingRef.current = true
      setError(null)

      try {
        cleanup()
    shouldReconnectRef.current = false
    reconnectAttemptsRef.current = 0

        transcriptBufferRef.current = ''
        currentSpeakerIdRef.current = null

        const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        const res = await fetch(`${api}/api/deepgram?language=${language}&diarize=true`)
        if (!res.ok) throw new Error('Failed to fetch Deepgram connection')

        const { wsUrl, apiKey } = await res.json()

      shouldReconnectRef.current = true
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

          const speakerId = currentSpeakerIdRef.current ?? ''
          let role = speakerRoleMapRef.current[speakerId]

          if (!role) {
            role = speakerDetectionService.detectSpeaker(utterance, lastSpeakerRef.current).speaker
            if (speakerId) speakerRoleMapRef.current[speakerId] = role
          }

          lastSpeakerRef.current = role

          onTranscript({
            id: crypto.randomUUID(),
            text: utterance,
            speaker: role,
            timestamp: Date.now(),
          })

          transcriptBufferRef.current = ''
          currentSpeakerIdRef.current = null
        }

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data)
            const alt = data.channel?.alternatives?.[0]
            if (!alt || !data.is_final) return

            const text = alt.transcript?.trim()

            const rawSpeaker = alt.words?.[0]?.speaker
            const nextSpeakerId = rawSpeaker === undefined || rawSpeaker === null ? '' : String(rawSpeaker)

            if (nextSpeakerId) {
              if (currentSpeakerIdRef.current && currentSpeakerIdRef.current !== nextSpeakerId && transcriptBufferRef.current) {
                flushTranscript()
              }
              currentSpeakerIdRef.current = nextSpeakerId
            }

            if (text) {
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

            if (data.speech_final) {
              flushTranscript()
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

          if (shouldReconnectRef.current && reconnectAttemptsRef.current < 5) {
            reconnectAttemptsRef.current++
            setTimeout(() => connect(language, onTranscript), 800)
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

  return { connect, disconnect, isConnected, error }
}