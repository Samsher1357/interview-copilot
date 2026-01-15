'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useCopilotStore } from '@/lib/store'
import { useDeepgram } from '@/lib/hooks/useDeepgram'
import { useUtteranceBuilder } from '@/lib/hooks/useUtteranceBuilder'
import { useSocketAnalysis } from '@/lib/hooks/useSocketAnalysis'
import { getIntentDebugInfo, shouldTriggerLLM, shouldContinueListening } from '@/lib/utils/intentClassifier'
import { getStateMachine, resetStateMachine, ConversationEvent } from '@/lib/ConversationStateMachine'
import { Utterance } from '@/lib/types'

export function CopilotEngine() {
  const store = useCopilotStore()
  const {
    isInterviewStarted,
    currentLanguage,
    simpleEnglish,
    aiModel,
    interviewContext,
    setConversationState,
    addUtterance,
    addTurn,
    setStreamingResponse,
    appendStreamingChunk,
    commitStreamingToTurn,
    setError,
  } = store

  const { analyze, cancel: cancelAnalysis } = useSocketAnalysis()
  const mountedRef = useRef(true)
  const fsmRef = useRef(getStateMachine())
  
  // Read state from FSM, not store, to avoid race conditions
  const conversationState = fsmRef.current.getState()

  // Initialize FSM with callbacks
  useEffect(() => {
    fsmRef.current = getStateMachine({
      onCancelAnalysis: () => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[CopilotEngine] FSM callback: Cancel analysis`)
        }
        cancelAnalysis()
        setStreamingResponse(null)
      },
      onDropPendingAnalysis: () => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[CopilotEngine] FSM callback: Drop pending analysis`)
        }
        cancelAnalysis()
      },
      onResetTimers: () => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[CopilotEngine] FSM callback: Reset timers`)
        }
        resetTimers()
      },
    })

    return () => {
      resetStateMachine()
    }
  }, [cancelAnalysis, setStreamingResponse])

  // Sync FSM state to store and force re-render
  const [, forceUpdate] = useState({})
  useEffect(() => {
    const unsubscribe = fsmRef.current.subscribe((state) => {
      setConversationState(state)
      forceUpdate({}) // Force re-render when FSM state changes
    })
    return unsubscribe
  }, [setConversationState])

  // Dispatch FSM event helper
  const dispatch = useCallback((event: ConversationEvent) => {
    return fsmRef.current.dispatch(event)
  }, [])

  // Trigger LLM analysis
  const triggerAnalysis = useCallback((utteranceText: string) => {
    const fsm = fsmRef.current
    
    if (!fsm.canStartAnalysis()) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[CopilotEngine] Cannot start analysis in state: ${fsm.getState()}`)
      }
      return
    }

    dispatch('ANALYSIS_START')
    setError(null)

    const generationId = fsm.getGenerationId()
    const currentTurns = useCopilotStore.getState().turns.slice(-6)

    if (process.env.NODE_ENV === 'development') {
      console.log(`[CopilotEngine] Triggering analysis (gen ${generationId}): "${utteranceText.slice(0, 50)}..."`)
    }
    analyze(
      currentTurns,
      utteranceText,
      currentLanguage.split('-')[0],
      interviewContext,
      simpleEnglish,
      aiModel,
      generationId,
      {
        onChunk: (chunk) => {
          if (!mountedRef.current) return
          
          const fsm = fsmRef.current
          if (!fsm.isGenerationValid(generationId)) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`[CopilotEngine] Ignoring chunk for invalid generation`)
            }
            return
          }

          if (!fsm.canReceiveChunks()) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`[CopilotEngine] Cannot receive chunks in state: ${fsm.getState()}`)
            }
            return
          }

          dispatch('ANALYSIS_CHUNK')
          
          const state = useCopilotStore.getState()
          if (!state.streamingResponse) {
            setStreamingResponse('', `stream-${generationId}`)
          }
          appendStreamingChunk(chunk)
        },
        onComplete: (fullResponse) => {
          if (!mountedRef.current) return
          
          const fsm = fsmRef.current
          if (!fsm.isGenerationValid(generationId)) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`[CopilotEngine] Ignoring complete for invalid generation`)
            }
            return
          }

          dispatch('ANALYSIS_COMPLETE')
          commitStreamingToTurn()
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`[CopilotEngine] Analysis complete (gen ${generationId})`)
          }
        },
        onError: (error) => {
          if (!mountedRef.current) return
          
          console.error(`[CopilotEngine] Analysis error:`, error)
          dispatch('ANALYSIS_ERROR')
          setError(error)
          setStreamingResponse(null)
        },
      }
    )
  }, [
    analyze, currentLanguage, interviewContext, simpleEnglish, aiModel,
    dispatch, setError, setStreamingResponse, appendStreamingChunk, commitStreamingToTurn
  ])

  // Utterance builder - declare first
  const utteranceBuilderRef = useRef<{ resetTimers: () => void } | null>(null)

  // Handle completed utterance
  const handleUtteranceComplete = useCallback((utterance: Utterance) => {
    if (!mountedRef.current) return

    const fsm = fsmRef.current
    
    // Validate utterance has content
    if (!utterance.text || utterance.text.trim().length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[CopilotEngine] Skipping empty utterance`)
      }
      return
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[CopilotEngine] Utterance complete: "${utterance.text.slice(0, 50)}..." (state: ${fsm.getState()})`)
    }

    // Dispatch utterance complete - FSM handles interruption logic
    dispatch('UTTERANCE_COMPLETE')

    // Add to memory
    addUtterance(utterance)
    addTurn({
      speaker: 'user',
      content: utterance.text,
      timestamp: utterance.endTime,
    })

    // Intent gating
    const { intent, shouldTrigger, shouldContinue, reason } = getIntentDebugInfo(utterance.text)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[CopilotEngine] Intent: ${intent} (${reason})`)
    }

    if (shouldContinue) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[CopilotEngine] Continue listening - user mid-thought`)
      }
      utteranceBuilderRef.current?.resetTimers()
      return
    }
    
    if (!shouldTrigger) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[CopilotEngine] Not triggering LLM`)
      }
      return
    }

    // Small delay to allow FSM to settle after UTTERANCE_COMPLETE
    setTimeout(() => {
      if (mountedRef.current && fsmRef.current.canStartAnalysis()) {
        triggerAnalysis(utterance.text)
      }
    }, 50)
  }, [addUtterance, addTurn, dispatch, triggerAnalysis])

  // Utterance builder
  const { processResult, forceCommit, reset: resetBuilder, resetTimers } = useUtteranceBuilder({
    onUtteranceComplete: handleUtteranceComplete,
  })
  
  // Store resetTimers in ref for use in handleUtteranceComplete
  useEffect(() => {
    utteranceBuilderRef.current = { resetTimers }
  }, [resetTimers])

  // Speech event handlers
  const handleSpeechStart = useCallback(() => {
    if (!mountedRef.current) return
    
    const fsm = fsmRef.current
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[CopilotEngine] Speech started (state: ${fsm.getState()})`)
    }
    
    if (fsm.isAIActive()) {
      dispatch('USER_INTERRUPT')
    } else {
      dispatch('SPEECH_START')
    }
  }, [dispatch])

  const handleSpeechEnd = useCallback(() => {
    if (!mountedRef.current) return
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[CopilotEngine] Speech ended`)
    }
    dispatch('SPEECH_END')
  }, [dispatch])

  // Deepgram connection
  const {
    connect,
    disconnect,
    startMicrophone,
    stopMicrophone,
    isConnected,
    isMicActive,
    error: deepgramError,
    interimText,
  } = useDeepgram({
    onResult: processResult,
    onSpeechStart: handleSpeechStart,
    onSpeechEnd: handleSpeechEnd,
  })

  // Sync deepgram error
  useEffect(() => {
    if (deepgramError) setError(deepgramError)
  }, [deepgramError, setError])

  // Connect/disconnect based on interview state
  useEffect(() => {
    mountedRef.current = true

    if (isInterviewStarted) {
      dispatch('START_INTERVIEW')
      connect(currentLanguage)
    } else {
      dispatch('STOP_INTERVIEW')
      cancelAnalysis()
      disconnect()
      forceCommit()
      resetBuilder()
      setStreamingResponse(null)
    }

    return () => {
      mountedRef.current = false
      cancelAnalysis()
    }
  }, [isInterviewStarted, currentLanguage, connect, disconnect, cancelAnalysis, forceCommit, resetBuilder, setStreamingResponse, dispatch])

  // Auto-start mic when connected and should listen
  useEffect(() => {
    if (!isInterviewStarted || !isConnected) return

    const fsm = fsmRef.current
    if (fsm.shouldListenToMic() && !isMicActive) {
      startMicrophone()
    }
  }, [isInterviewStarted, isConnected, conversationState, isMicActive, startMicrophone])

  if (!isInterviewStarted) return null

  if (!isConnected && !deepgramError) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
        <p className="text-blue-800 dark:text-blue-200 text-sm">🔄 Connecting to Deepgram…</p>
      </div>
    )
  }

  if (interimText && fsmRef.current.shouldListenToMic()) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 mt-4">
        <p className="text-gray-600 dark:text-gray-400 text-sm italic">🎤 {interimText}</p>
      </div>
    )
  }

  return null
}
