'use client'

import { useEffect, useRef } from 'react'
import { useInterviewStore, TranscriptEntry } from '@/lib/store'
import { useSocketAnalysis } from '@/lib/hooks/useSocketAnalysis'
import { useDeepgram } from '@/lib/hooks/useDeepgram'
import { isNoise } from '@/lib/utils/textFilters'

/* ======================================================
   CONSTANTS
====================================================== */

const MAX_TRANSCRIPTS_FOR_ANALYSIS = 8
const MIN_ANALYSIS_INTERVAL = 500
const STREAM_BUFFER_DESKTOP = 100
const STREAM_BUFFER_MOBILE = 150

/* ======================================================
   COMPONENT
====================================================== */

export function DeepgramTranscriber() {
  const store = useInterviewStore()
  const {
    isListening,
    isInterviewStarted,
    currentLanguage,
    simpleEnglish,
    aiModel,
    addTranscript,
    addAIResponse,
    setError,
  } = store

  const { connect, disconnect, startMicrophone, stopMicrophone, isConnected, isMicActive, error: deepgramError, interimTranscript } = useDeepgram()
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

  // Transcript buffer
  const transcriptBufferRef = useRef<{
    speaker: 'user'
    text: string
    timestamp: number
    timeout: NodeJS.Timeout | null
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

  const commitTranscriptBuffer = () => {
    const buffer = transcriptBufferRef.current
    if (!buffer) return

    addTranscript({
      id: `transcript-${Date.now()}-${Math.random()}`,
      speaker: buffer.speaker,
      text: buffer.text.trim(),
      timestamp: buffer.timestamp,
    })

    transcriptBufferRef.current = null
    triggerAnalysis()
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
      state.setIsAnalyzing(true)
      state.setError(null)

      analyzeWithStreaming(
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

    const speaker = 'user'
    const buffer = transcriptBufferRef.current

    if (buffer?.speaker === speaker) {
      // Clear existing timeout
      if (buffer.timeout) {
        clearTimeout(buffer.timeout)
      }
      
      buffer.text += ' ' + entry.text.trim()
      buffer.timeout = setTimeout(commitTranscriptBuffer, timeoutMs)
    } else {
      if (buffer) commitTranscriptBuffer()
      
      transcriptBufferRef.current = {
        speaker,
        text: entry.text.trim(),
        timestamp: now,
        timeout: setTimeout(commitTranscriptBuffer, timeoutMs),
      }
    }
  }

  /* ======================================================
     START / STOP CONNECTION (BASED ON INTERVIEW STARTED)
  ====================================================== */

  useEffect(() => {
    mountedRef.current = true

    if (isInterviewStarted) {
      // Connect to Deepgram when interview starts
      connect(langRef.current || 'en-US', handleTranscript)
    } else {
      // Disconnect when interview ends
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
  }, [isInterviewStarted, connect, disconnect])

  /* ======================================================
     START / STOP MICROPHONE (BASED ON LISTENING STATE)
  ====================================================== */

  useEffect(() => {
    if (!isInterviewStarted || !isConnected) return

    if (isListening) {
      startMicrophone()
    } else {
      stopMicrophone()
    }
  }, [isListening, isInterviewStarted, isConnected, startMicrophone, stopMicrophone])

  /* ======================================================
     UI
  ====================================================== */

  if (!isInterviewStarted) return null

  if (!isConnected && !deepgramError) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
        <p className="text-blue-800 dark:text-blue-200 text-sm">
          🔄 Connecting to Deepgram…
        </p>
      </div>
    )
  }

  // Show interim transcript in real-time only when listening
  if (isListening && interimTranscript) {
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