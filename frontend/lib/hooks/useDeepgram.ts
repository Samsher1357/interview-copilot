'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient, LiveTranscriptionEvents, LiveClient } from '@deepgram/sdk'
import { TranscriptEntry } from '@/lib/store'
import { retryWithBackoff } from '@/lib/utils/retryWithBackoff'

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_BASE_DELAY = 1000

export function useDeepgram() {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [interimTranscript, setInterimTranscript] = useState<string>('')
  const [isSpeaking, setIsSpeaking] = useState(false)

  const deepgramRef = useRef<LiveClient | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const connectingRef = useRef(false)
  const shouldReconnectRef = useRef(true)
  const onTranscriptCallbackRef = useRef<((entry: TranscriptEntry) => void) | null>(null)

  const transcriptBufferRef = useRef('')

  const cleanup = () => {
    // PRIORITY 1: Stop microphone immediately (this removes browser mic indicator)
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      mediaStreamRef.current = null
    }

    // PRIORITY 2: Close Deepgram connection to stop data flow
    if (deepgramRef.current) {
      deepgramRef.current.requestClose()
      deepgramRef.current = null
    }

    // PRIORITY 3: Disconnect audio processing
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect()
      workletNodeRef.current = null
    }

    // PRIORITY 4: Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
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
    setIsSpeaking(false)
  }, [])

  const connect = useCallback(
    async (onTranscript: (entry: TranscriptEntry) => void) => {
      if (connectingRef.current || deepgramRef.current) return
      connectingRef.current = true
      setError(null)

      try {
        cleanup()
        shouldReconnectRef.current = true
        reconnectAttemptsRef.current = 0
        onTranscriptCallbackRef.current = onTranscript

        transcriptBufferRef.current = ''

        const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        
        // Fetch Deepgram API key from backend
        const { apiKey } = await retryWithBackoff(
          async () => {
            const res = await fetch(`${api}/api/deepgram`)
            if (!res.ok) {
              throw new Error(`Failed to fetch Deepgram API key: ${res.status}`)
            }
            return res.json()
          },
          {
            maxRetries: 3,
            initialDelayMs: 1000,
          }
        )

        // Initialize Deepgram SDK client
        const deepgram = createClient(apiKey)

        // Create live transcription connection with optimized settings for English
        const connection = deepgram.listen.live({
          model: 'nova-3',
          language: 'en-US',
          punctuate: true,
          smart_format: true,
          interim_results: true,
          utterance_end_ms: 3000, // 3s pause for natural conversation flow
          vad_events: true, // Enable voice activity detection events
          filler_words: true,
          encoding: 'linear16',
          sample_rate: 16000,
          channels: 1,
        })

        deepgramRef.current = connection

        // Set up event handlers
        connection.on(LiveTranscriptionEvents.Open, () => {
          console.log('Deepgram connection opened')
          setIsConnected(true)
          setError(null)
          reconnectAttemptsRef.current = 0
          connectingRef.current = false
        })

        connection.on(LiveTranscriptionEvents.Close, () => {
          console.log('Deepgram connection closed')
          setIsConnected(false)
          cleanup()
          connectingRef.current = false

          // Exponential backoff for reconnection
          if (shouldReconnectRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current++
            const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1)
            setError(`Reconnecting... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`)
            setTimeout(() => {
              if (onTranscriptCallbackRef.current) {
                connect(onTranscriptCallbackRef.current)
              }
            }, delay)
          } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            setError('Failed to reconnect after multiple attempts')
          }
        })

        connection.on(LiveTranscriptionEvents.Error, (error) => {
          console.error('Deepgram error:', error)
          setError('Transcription error occurred')
        })

        // Voice Activity Detection events
        connection.on(LiveTranscriptionEvents.SpeechStarted, () => {
          console.log('VAD: Speech started')
          setIsSpeaking(true)
        })

        connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
          console.log('VAD: Utterance ended - flushing transcript')
          // UtteranceEnd fires after utterance_end_ms silence detected
          flushTranscript()
          setIsSpeaking(false)
        })

        connection.on(LiveTranscriptionEvents.Transcript, (data) => {
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

          // Accumulate final transcripts
          if (data.is_final) {
            transcriptBufferRef.current = transcriptBufferRef.current 
              ? `${transcriptBufferRef.current} ${text}` 
              : text
          }
        })

        // Set up microphone capture
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { 
            channelCount: 1, 
            sampleRate: 16000, 
            echoCancellation: true, 
            noiseSuppression: true 
          },
        })
        mediaStreamRef.current = stream

        // Set up audio context and worklet for processing
        const ctx = new AudioContext({ sampleRate: 16000 })
        audioContextRef.current = ctx

        // Resume AudioContext if suspended (required by some browsers)
        if (ctx.state === 'suspended') {
          await ctx.resume()
        }

        await ctx.audioWorklet.addModule('/worklets/pcm-encoder.js')
        const worklet = new AudioWorkletNode(ctx, 'pcm-encoder')
        const source = ctx.createMediaStreamSource(stream)
        source.connect(worklet)
        workletNodeRef.current = worklet

        // Send audio data to Deepgram
        worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
          if (connection.getReadyState() === 1) { // OPEN state
            connection.send(e.data)
          }
        }

      } catch (err: any) {
        console.error('Connection error:', err)
        setError(err.message || 'Connection failed')
        cleanup()
        connectingRef.current = false
        setIsConnected(false)
      }
    },
    []
  )

  const flushTranscript = () => {
    const utterance = transcriptBufferRef.current.trim()
    
    // Clear buffer first to prevent duplicate flushes
    transcriptBufferRef.current = ''
    
    if (!utterance || !onTranscriptCallbackRef.current) {
      console.log('Skipping flush: empty utterance or no callback')
      return
    }

    console.log('Flushing transcript:', utterance)
    onTranscriptCallbackRef.current({
      id: crypto.randomUUID(),
      text: utterance,
      speaker: 'user',
      timestamp: Date.now(),
    })
  }

  useEffect(() => disconnect, [disconnect])

  return { connect, disconnect, isConnected, error, interimTranscript, isSpeaking }
}