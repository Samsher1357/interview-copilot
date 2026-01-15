'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { retryWithBackoff } from '@/lib/utils/retryWithBackoff'

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_BASE_DELAY = 1000

interface DeepgramResult {
  text: string
  confidence: number
  isFinal: boolean
  speechFinal: boolean
}

interface UseDeepgramConfig {
  onResult: (result: DeepgramResult) => void
  onSpeechStart?: () => void
  onSpeechEnd?: () => void
}

export function useDeepgram(config: UseDeepgramConfig) {
  const { onResult, onSpeechStart, onSpeechEnd } = config

  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMicActive, setIsMicActive] = useState(false)
  const [interimText, setInterimText] = useState('')

  const wsRef = useRef<WebSocket | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const connectingRef = useRef(false)
  const shouldReconnectRef = useRef(true)
  const isSpeakingRef = useRef(false)

  const cleanupMicrophone = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect() } catch {}
      sourceNodeRef.current = null
    }
    if (workletNodeRef.current) {
      try { workletNodeRef.current.disconnect() } catch {}
      workletNodeRef.current = null
    }
    if (audioContextRef.current?.state !== 'closed') {
      try { audioContextRef.current?.close() } catch {}
    }
    audioContextRef.current = null
  }, [])

  const cleanup = useCallback(() => {
    cleanupMicrophone()
    if (wsRef.current) {
      wsRef.current.close(1000)
      wsRef.current = null
    }
  }, [cleanupMicrophone])

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    connectingRef.current = false
    cleanup()
    setIsConnected(false)
    setIsMicActive(false)
    setError(null)
    setInterimText('')
  }, [cleanup])

  const startMicrophone = useCallback(async () => {
    if (isMicActive || !isConnected) return
    shouldReconnectRef.current = true

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      })
      mediaStreamRef.current = stream

      if (!audioContextRef.current) {
        const ctx = new AudioContext({ sampleRate: 16000 })
        audioContextRef.current = ctx
        if (ctx.state === 'suspended') await ctx.resume()
        await ctx.audioWorklet.addModule('/worklets/pcm-encoder.js')
      }

      const ctx = audioContextRef.current
      const worklet = new AudioWorkletNode(ctx, 'pcm-encoder')
      const source = ctx.createMediaStreamSource(stream)
      source.connect(worklet)

      workletNodeRef.current = worklet
      sourceNodeRef.current = source

      worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(e.data)
        }
      }

      setIsMicActive(true)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to start microphone')
      cleanupMicrophone()
    }
  }, [isMicActive, isConnected, cleanupMicrophone])

  const stopMicrophone = useCallback(() => {
    shouldReconnectRef.current = false
    cleanupMicrophone()
    setIsMicActive(false)
    setInterimText('')
    if (isSpeakingRef.current) {
      isSpeakingRef.current = false
      onSpeechEnd?.()
    }
  }, [cleanupMicrophone, onSpeechEnd])

  const connect = useCallback(async (language: string = 'en-US') => {
    if (connectingRef.current || wsRef.current) return
    connectingRef.current = true
    setError(null)

    try {
      cleanup()
      shouldReconnectRef.current = true
      reconnectAttemptsRef.current = 0

      const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

      const { wsUrl, apiKey } = await retryWithBackoff(
        async () => {
          const res = await fetch(`${api}/api/deepgram?language=${language}&diarize=false`)
          if (!res.ok) throw new Error(`Failed to fetch Deepgram connection: ${res.status}`)
          return res.json()
        },
        {
          maxRetries: 3,
          initialDelayMs: 1000,
          onRetry: (attempt) => setError(`Connecting... (attempt ${attempt})`),
        }
      )

      const ws = new WebSocket(wsUrl, ['token', apiKey])
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        setError(null)
        reconnectAttemptsRef.current = 0
        connectingRef.current = false
      }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (!data || data.type !== 'Results') return

          const alt = data.channel?.alternatives?.[0]
          if (!alt) return

          const text = alt.transcript?.trim()
          if (!text) return

          // Track speech state
          if (!isSpeakingRef.current && text) {
            isSpeakingRef.current = true
            onSpeechStart?.()
          }

          if (!data.is_final) {
            setInterimText(text)
            return
          }

          setInterimText('')

          // Only emit final + speech_final results
          if (data.is_final && data.speech_final) {
            onResult({
              text,
              confidence: alt.confidence ?? 0.8,
              isFinal: true,
              speechFinal: true,
            })

            // Speech ended
            if (isSpeakingRef.current) {
              isSpeakingRef.current = false
              onSpeechEnd?.()
            }
          }
        } catch {}
      }

      ws.onerror = () => setError('WebSocket error')

      ws.onclose = () => {
        setIsConnected(false)
        cleanup()
        connectingRef.current = false

        if (shouldReconnectRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++
          const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1)
          setError(`Reconnecting... (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`)
          setTimeout(() => connect(language), delay)
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError('Failed to reconnect')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Connection failed')
      cleanup()
      connectingRef.current = false
      setIsConnected(false)
    }
  }, [cleanup, onResult, onSpeechStart, onSpeechEnd])

  useEffect(() => disconnect, [disconnect])

  return {
    connect,
    disconnect,
    startMicrophone,
    stopMicrophone,
    isConnected,
    isMicActive,
    error,
    interimText,
  }
}
