'use client'

import { useEffect, useRef } from 'react'
import { useInterviewStore, TranscriptEntry } from '@/lib/store'
import { useSocketAnalysis } from '@/lib/hooks/useSocketAnalysis'
import { useDeepgram } from '@/lib/hooks/useDeepgram'
import { isNoise } from '@/lib/utils/textFilters'

/* ======================================================
   CONSTANTS
====================================================== */

const MIN_ANALYSIS_INTERVAL = 500

/* ======================================================
   COMPONENT
   
   VAD-BASED AUTO-TRIGGERING WITH INCREMENTAL ANALYSIS:
   1. useDeepgram detects speech via SpeechStarted event (isSpeaking = true)
   2. User speaks and Deepgram buffers transcript internally
   3. After 1.5s silence, UtteranceEnd event fires (isSpeaking = false)
   4. useDeepgram flushes complete utterance via handleTranscript callback
   5. VAD useEffect detects isSpeaking transition (true → false)
   6. Analysis is auto-triggered 500ms after speech ends
   7. Only UNANALYZED transcripts + interview context sent to AI
   8. Tracks analyzed vs unanalyzed to avoid reprocessing
   9. Handles multiple rapid transcripts and failed analyses gracefully
====================================================== */

export function DeepgramTranscriber() {
  const store = useInterviewStore()
  const {
    isListening,
    simpleEnglish,
    aiModel,
    addTranscript,
    addAIResponse,
    setError,
  } = store

  const { connect, disconnect, isConnected, error: deepgramError, interimTranscript, isSpeaking } = useDeepgram()
  const { analyzeWithStreaming, cancel: cancelStreaming } = useSocketAnalysis()

  /* ======================================================
     REFS (NO RE-RENDERS)
  ====================================================== */

  const mountedRef = useRef(true)
  const lastAnalysisAtRef = useRef(0)
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isRunningAnalysisRef = useRef(false)
  const lastSpeakingStateRef = useRef(false)
  const lastAnalyzedIndexRef = useRef(-1) // Track last analyzed transcript index

  const streamingTextRef = useRef('')
  const streamingIdRef = useRef<string | null>(null)

  const simpleRef = useRef(simpleEnglish)
  const modelRef = useRef(aiModel)

  // Transcript buffer
  // Removed - using VAD-based utterance completion from useDeepgram instead

  /* ======================================================
     REF SYNC
  ====================================================== */

  useEffect(() => {
    simpleRef.current = simpleEnglish
    modelRef.current = aiModel
  }, [simpleEnglish, aiModel])

  useEffect(() => {
    if (deepgramError) setError(deepgramError)
  }, [deepgramError, setError])

  /* ======================================================
     UTILITIES
  ====================================================== */

  const commitTranscript = (entry: TranscriptEntry) => {
    if (isNoise(entry.text)) return

    addTranscript({
      id: entry.id,
      speaker: entry.speaker,
      text: entry.text.trim(),
      timestamp: entry.timestamp,
    })
  }

  /* ======================================================
     VAD EVENT HANDLER - Auto-trigger on speech end
  ====================================================== */

  useEffect(() => {
    // Trigger analysis when user stops speaking
    if (lastSpeakingStateRef.current && !isSpeaking && isListening) {
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current)
      analysisTimeoutRef.current = setTimeout(triggerAnalysis, 500)
    }
    lastSpeakingStateRef.current = isSpeaking
  }, [isSpeaking, isListening])

  /* ======================================================
     AI ANALYSIS TRIGGER (THROTTLED)
  ====================================================== */

  const triggerAnalysis = () => {
    if (isRunningAnalysisRef.current || !mountedRef.current) return
    
    const now = Date.now()
    if (now - lastAnalysisAtRef.current < MIN_ANALYSIS_INTERVAL) return
    
    lastAnalysisAtRef.current = now
    cancelStreaming()
    runAnalysis()
  }

  const runAnalysis = () => {
    const state = useInterviewStore.getState()
    if (!state.isListening || isRunningAnalysisRef.current) return

    const unanalyzedTranscripts = state.transcripts
      .slice(lastAnalyzedIndexRef.current + 1)
      .filter(t => !isNoise(t.text))
    
    if (unanalyzedTranscripts.length === 0) {
      lastAnalyzedIndexRef.current = state.transcripts.length - 1
      return
    }

    isRunningAnalysisRef.current = true
    streamingTextRef.current = ''
    streamingIdRef.current = null
    state.setIsAnalyzing(true)
    state.setError(null)

    analyzeWithStreaming({
      transcripts: unanalyzedTranscripts,
      language: 'en',
      interviewContext: state.interviewContext,
      simpleEnglish: simpleRef.current,
      aiModel: modelRef.current,
      onChunk: onStreamChunk,
      onComplete: onStreamComplete,
      onError: onStreamError
    })
  }

  const onStreamChunk = (chunk: string) => {
    streamingTextRef.current += chunk

    if (streamingIdRef.current) {
      useInterviewStore.getState().updateAIResponse(streamingIdRef.current, {
        content: streamingTextRef.current,
      })
    } else {
      streamingIdRef.current = `ai-stream-${Date.now()}`
      addAIResponse({
        id: streamingIdRef.current,
        type: 'answer',
        content: streamingTextRef.current,
        timestamp: Date.now(),
        confidence: 0.9,
      })
    }
  }

  const onStreamComplete = (responses: any[]) => {
    if (streamingIdRef.current) {
      useInterviewStore.getState().removeAIResponse(streamingIdRef.current)
      streamingIdRef.current = null
    }

    responses.forEach(addAIResponse)
    lastAnalyzedIndexRef.current = useInterviewStore.getState().transcripts.length - 1
    
    const state = useInterviewStore.getState()
    state.setIsAnalyzing(false)
    isRunningAnalysisRef.current = false
  }

  const onStreamError = (msg?: string) => {
    const state = useInterviewStore.getState()
    state.setError(msg || 'AI analysis failed')
    state.setIsAnalyzing(false)
    isRunningAnalysisRef.current = false
  }

  /* ======================================================
     TRANSCRIPT HANDLER
  ====================================================== */

  const handleTranscript = (entry: TranscriptEntry) => {
    commitTranscript(entry)
  }

  /* ======================================================
     START / STOP LISTENING
  ====================================================== */

  useEffect(() => {
    mountedRef.current = true

    if (isListening) {
      lastAnalyzedIndexRef.current = -1
      lastAnalysisAtRef.current = 0
      connect(handleTranscript)
    } else {
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current)
      cancelStreaming()
      disconnect()
      if (streamingIdRef.current) {
        useInterviewStore.getState().removeAIResponse(streamingIdRef.current)
      }
    }

    return () => {
      mountedRef.current = false
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current)
      cancelStreaming()
    }
  }, [isListening, connect, disconnect, cancelStreaming])

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

  // Show interim transcript in real-time with voice activity indicator
  if (interimTranscript) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 mt-4">
        <div className="flex items-start gap-2">
          {isSpeaking && (
            <div className="flex-shrink-0 mt-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </div>
          )}
          <p className="text-gray-600 dark:text-gray-400 text-sm italic flex-1">
            🎤 {interimTranscript}
          </p>
        </div>
      </div>
    )
  }

  // Show listening indicator when connected but no speech yet
  if (isConnected) {
    return (
      <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-3 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <p className="text-green-700 dark:text-green-300 text-xs">
            {isSpeaking ? 'Listening - Speech detected' : 'Listening - Ready for speech'}
          </p>
        </div>
      </div>
    )
  }

  return null
}