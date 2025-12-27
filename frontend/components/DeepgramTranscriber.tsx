'use client'

import { useEffect, useRef } from 'react'
import { useInterviewStore, TranscriptEntry } from '@/lib/store'
import { useSocketAnalysis } from '@/lib/hooks/useSocketAnalysis'
import { useDeepgram } from '@/lib/hooks/useDeepgram'
import { perfMonitor } from '@/lib/utils/performanceMonitor'

/* ======================================================
   CONSTANTS
====================================================== */

const MAX_TRANSCRIPTS_FOR_ANALYSIS = 8
const MIN_ANALYSIS_INTERVAL = 500
const STREAM_BUFFER_DESKTOP = 100
const STREAM_BUFFER_MOBILE = 150

const IGNORED_PHRASES =
  /^(ok|okay|yes|no|yeah|yep|nope|uh|um|hmm|ah|eh|right|sure|mhm|uh-huh)$/i

/* ======================================================
   COMPONENT
====================================================== */

export function DeepgramTranscriber() {
  const store = useInterviewStore()
  const {
    isListening,
    currentLanguage,
    simpleEnglish,
    aiModel,
    addTranscript,
    addAIResponse,
    setError,
  } = store

  const { connect, disconnect, isConnected, error: deepgramError, interimTranscript } = useDeepgram()
  const { analyzeWithStreaming, cancel: cancelStreaming } = useSocketAnalysis()

  /* ======================================================
     REFS (NO RE-RENDERS)
  ====================================================== */

  const mountedRef = useRef(true)
  const lastAnalysisAtRef = useRef(0)
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const streamingTextRef = useRef('')
  const streamingIdRef = useRef<string | null>(null)

  const langRef = useRef(currentLanguage)
  const simpleRef = useRef(simpleEnglish)
  const modelRef = useRef(aiModel)

  // Improved buffer with lock to prevent race conditions
  const transcriptBufferRef = useRef<{
    speaker: 'user'
    text: string
    timestamp: number
    lastChunkAt: number
    timeout: NodeJS.Timeout | null
    isCommitting: boolean // Lock to prevent concurrent commits
  } | null>(null)

  /* ======================================================
     REF SYNC
  ====================================================== */

  useEffect(() => {
    langRef.current = currentLanguage
    simpleRef.current = simpleEnglish
    modelRef.current = aiModel
  }, [currentLanguage, simpleEnglish, aiModel])

  useEffect(() => {
    if (deepgramError) setError(deepgramError)
  }, [deepgramError, setError])

  /* ======================================================
     UTILITIES
  ====================================================== */

  const isNoise = (text: string): boolean => {
    const t = text.trim().toLowerCase()
    if (t.length < 3) return true
    if (IGNORED_PHRASES.test(t)) return true
    if (/^[^\w\s]+$/.test(t)) return true
    return false
  }

  const commitTranscriptBuffer = () => {
    const buffer = transcriptBufferRef.current
    if (!buffer || buffer.isCommitting) return

    // Set lock to prevent concurrent commits
    buffer.isCommitting = true

    try {
      addTranscript({
        id: `transcript-${Date.now()}-${Math.random()}`,
        speaker: buffer.speaker,
        text: buffer.text.trim(),
        timestamp: buffer.timestamp,
      })

      transcriptBufferRef.current = null
      triggerAnalysis()
    } finally {
      // Lock is released by setting buffer to null above
      // or will be released when buffer is recreated
    }
  }

  /* ======================================================
     AI ANALYSIS TRIGGER (THROTTLED)
  ====================================================== */

  const triggerAnalysis = () => {
    if (!mountedRef.current) return
    if (!useInterviewStore.getState().isListening) return

    const now = Date.now()
    const delta = now - lastAnalysisAtRef.current

    if (delta < MIN_ANALYSIS_INTERVAL) {
      clearTimeout(analysisTimeoutRef.current!)
      analysisTimeoutRef.current = setTimeout(
        triggerAnalysis,
        MIN_ANALYSIS_INTERVAL - delta
      )
      return
    }

    lastAnalysisAtRef.current = now
    cancelStreaming()

    analysisTimeoutRef.current = setTimeout(runAnalysis, 0)
  }

  const runAnalysis = async () => {
    const state = useInterviewStore.getState()
    if (!state.isListening || !mountedRef.current) return

    const transcripts = state.transcripts.slice(-MAX_TRANSCRIPTS_FOR_ANALYSIS)
    const last = transcripts.at(-1)
    if (!last || isNoise(last.text)) return

    streamingTextRef.current = ''
    streamingIdRef.current = null

    try {
      perfMonitor.start('ai-analysis')
      state.setIsAnalyzing(true)
      state.setError(null)

      await analyzeWithStreaming(
        transcripts,
        langRef.current.split('-')[0],
        state.interviewContext,
        simpleRef.current,
        modelRef.current,
        onStreamChunk,
        onStreamComplete,
        onStreamError
      )
    } catch (e: any) {
      onStreamError(e?.message)
    }
  }

  const onStreamChunk = (chunk: string) => {
    if (!mountedRef.current || !useInterviewStore.getState().isListening) return

    streamingTextRef.current += chunk

    if (!streamingIdRef.current) {
      streamingIdRef.current = `ai-stream-${Date.now()}`
      addAIResponse({
        id: streamingIdRef.current,
        type: 'answer',
        content: streamingTextRef.current,
        timestamp: Date.now(),
        confidence: 0.9,
      })
    } else {
      useInterviewStore
        .getState()
        .updateAIResponse(streamingIdRef.current, {
          content: streamingTextRef.current,
        })
    }
  }

  const onStreamComplete = (responses: any[]) => {
    perfMonitor.end('ai-analysis')

    if (streamingIdRef.current) {
      useInterviewStore.getState().removeAIResponse(streamingIdRef.current)
      streamingIdRef.current = null
    }

    responses.forEach(addAIResponse)
    useInterviewStore.getState().setIsAnalyzing(false)
  }

  const onStreamError = (msg?: string) => {
    useInterviewStore.getState().setError(msg || 'AI analysis failed')
    useInterviewStore.getState().setIsAnalyzing(false)
  }

  /* ======================================================
     TRANSCRIPT HANDLER
  ====================================================== */

  const handleTranscript = (entry: TranscriptEntry) => {
    if (isNoise(entry.text)) return

    const now = Date.now()
    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.innerWidth < 768

    const timeoutMs = isMobile
      ? STREAM_BUFFER_MOBILE
      : STREAM_BUFFER_DESKTOP

    const speaker = 'user' // All transcripts are from the user/candidate

    const buffer = transcriptBufferRef.current

    // Don't modify buffer if it's being committed
    if (buffer?.isCommitting) {
      // Create new buffer for this entry
      transcriptBufferRef.current = {
        speaker,
        text: entry.text.trim(),
        timestamp: now,
        lastChunkAt: now,
        timeout: null,
        isCommitting: false,
      }
    } else if (buffer?.speaker === speaker) {
      // Clear existing timeout before modifying
      if (buffer.timeout) {
        clearTimeout(buffer.timeout)
      }
      
      buffer.text += ' ' + entry.text.trim()
      buffer.lastChunkAt = now
      buffer.timeout = null
    } else {
      if (buffer) commitTranscriptBuffer()
      transcriptBufferRef.current = {
        speaker,
        text: entry.text.trim(),
        timestamp: now,
        lastChunkAt: now,
        timeout: null,
        isCommitting: false,
      }
    }

    // Set new timeout
    const currentBuffer = transcriptBufferRef.current
    if (currentBuffer && !currentBuffer.isCommitting) {
      currentBuffer.timeout = setTimeout(
        commitTranscriptBuffer,
        timeoutMs
      )
    }
  }

  /* ======================================================
     START / STOP LISTENING
  ====================================================== */

  useEffect(() => {
    mountedRef.current = true

    if (isListening) {
      connect(langRef.current || 'en-US', handleTranscript)
    } else {
      cancelStreaming()
      disconnect()

      if (streamingIdRef.current) {
        useInterviewStore.getState().removeAIResponse(streamingIdRef.current)
        streamingIdRef.current = null
      }

      if (transcriptBufferRef.current) {
        clearTimeout(transcriptBufferRef.current.timeout!)
        commitTranscriptBuffer()
      }

      useInterviewStore.getState().setIsAnalyzing(false)
      useInterviewStore.getState().setError(null)
    }

    return () => {
      mountedRef.current = false
      clearTimeout(analysisTimeoutRef.current!)
      clearTimeout(transcriptBufferRef.current?.timeout!)
      cancelStreaming()
    }
  }, [isListening, connect, disconnect])

  /* ======================================================
     UI
  ====================================================== */

  if (!isListening) return null

  if (!isConnected && !deepgramError) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
        <p className="text-blue-800 dark:text-blue-200 text-sm">
          🔄 Connecting to Deepgram…
        </p>
      </div>
    )
  }

  // Show interim transcript in real-time
  if (interimTranscript) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 mt-4">
        <p className="text-gray-600 dark:text-gray-400 text-sm italic">
          🎤 {interimTranscript}
        </p>
      </div>
    )
  }

  return null
}