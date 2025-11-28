'use client'

import { useEffect, useRef, useState } from 'react'
import { useInterviewStore, TranscriptEntry } from '@/lib/store'
import { useStreamingAnalysis } from '@/lib/hooks/useStreamingAnalysis'
import { speakerDetectionService } from '@/lib/speakerDetection'
import { useDeepgram } from '@/lib/hooks/useDeepgram'
import { perfMonitor } from '@/lib/utils/performanceMonitor'

export function DeepgramTranscriber() {
  const {
    isListening,
    currentLanguage,
    autoSpeak,
    simpleEnglish,
    aiModel,
    addTranscript,
    addAIResponse,
    setIsListening,
    setError,
  } = useInterviewStore()

  const { connect, disconnect, isConnected, error: deepgramError } = useDeepgram()
  const { analyzeWithStreaming, cancel: cancelStreaming } = useStreamingAnalysis()
  const streamingResponseRef = useRef<string>('')
  const streamingResponseIdRef = useRef<string | null>(null)
  const lastSpeakerRef = useRef<'interviewer' | 'applicant'>('interviewer')
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Buffer for accumulating transcript chunks
  const transcriptBufferRef = useRef<{
    text: string
    speaker: 'interviewer' | 'applicant'
    timestamp: number
    timeout: NodeJS.Timeout | null
    lastChunkTime: number
  } | null>(null)

  const currentLanguageRef = useRef(currentLanguage)
  const autoSpeakRef = useRef(autoSpeak)
  const simpleEnglishRef = useRef(simpleEnglish)
  const aiModelRef = useRef(aiModel)
  const MAX_TRANSCRIPTS_FOR_ANALYSIS = 8 // Optimized for speed
  const questionPattern = /\b(what|why|how|when|where|who|which|could you|would you|can you|tell me|describe|explain|walk me through|give me)\b/i
  const lastAnalysisTimeRef = useRef(0)
  const MIN_ANALYSIS_INTERVAL = 500 // Reduced to 500ms for faster response
  const isMountedRef = useRef(true)

  useEffect(() => {
    currentLanguageRef.current = currentLanguage
    autoSpeakRef.current = autoSpeak
    simpleEnglishRef.current = simpleEnglish
    aiModelRef.current = aiModel
  }, [currentLanguage, autoSpeak, simpleEnglish, aiModel])

  // Handle Deepgram errors
  useEffect(() => {
    if (deepgramError) {
      setError(deepgramError)
    }
  }, [deepgramError, setError])

  // Enhanced question detection with multiple criteria
  const isLikelyQuestion = (text: string) => {
    const normalized = text.trim().toLowerCase()
    if (!normalized) return false
    
    // Clear question mark
    if (normalized.endsWith('?')) return true
    
    // Question words at the start of sentence
    const questionStarters = /^(what|why|how|when|where|who|which|whose|whom|can you|could you|would you|will you|do you|did you|does|is there|are there|have you|has|should|may i ask)/i
    if (questionStarters.test(normalized)) return true
    
    // Common interview question patterns
    const interviewPatterns = [
      /tell me (about|more)/i,
      /describe (your|how|the)/i,
      /explain (how|why|what|the)/i,
      /walk me through/i,
      /give me (an? )?example/i,
      /what (is|are|was|were|do|does)/i,
      /how (do|does|did|would|can)/i,
      /why (do|does|did|is|are)/i,
      /can you (tell|explain|describe|walk)/i,
      /have you (ever|worked|done)/i,
      /talk about/i,
      /share (your|an?)/i,
    ]
    
    for (const pattern of interviewPatterns) {
      if (pattern.test(normalized)) return true
    }
    
    // Reject statements that are clearly not questions
    const statementPatterns = [
      /^(i think|i believe|i know|yes|no|okay|sure|right|exactly|absolutely|definitely|thank you|thanks)/i,
      /^(that's|thats|it's|its) (good|great|fine|correct|right|perfect)/i,
      /\b(just|only|simply) (wanted to|going to|trying to)\b/i,
    ]
    
    for (const pattern of statementPatterns) {
      if (pattern.test(normalized)) return false
    }
    
    // Check if sentence is long enough and has question characteristics
    const words = normalized.split(/\s+/).length
    if (words < 3) return false // Too short to be a meaningful question
    
    return questionPattern.test(normalized)
  }

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current)
      }
      if (transcriptBufferRef.current?.timeout) {
        clearTimeout(transcriptBufferRef.current.timeout)
      }
      cancelStreaming()
    }
  }, [])

  // OPTIMIZED: Helper function to trigger AI analysis with smart throttling
  const triggerAnalysis = () => {
    // CHECK: Don't start new analysis if we're not listening anymore
    const currentState = useInterviewStore.getState()
    if (!currentState.isListening || !isMountedRef.current) {
      return
    }
    
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current)
    }

    // PERFORMANCE: Throttle rapid analyses
    const now = Date.now()
    const timeSinceLastAnalysis = now - lastAnalysisTimeRef.current
    
    if (timeSinceLastAnalysis < MIN_ANALYSIS_INTERVAL) {
      // Too soon, schedule for later
      analysisTimeoutRef.current = setTimeout(() => {
        triggerAnalysis()
      }, MIN_ANALYSIS_INTERVAL - timeSinceLastAnalysis)
      return
    }

    cancelStreaming()

    // SMART ANALYSIS: Analyze all meaningful speech
    const currentTranscripts = useInterviewStore.getState().transcripts
    const lastTranscript = currentTranscripts[currentTranscripts.length - 1]
    
    // Skip only if transcript is empty or too short
    if (!lastTranscript || lastTranscript.text.trim().length < 5) {
      return
    }
    
    // Filter out very short acknowledgments and fillers
    const normalized = lastTranscript.text.trim().toLowerCase()
    const ignoredPhrases = /^(ok|okay|yes|no|yeah|yep|nope|uh|um|hmm|ah|eh|right|sure|mhm|uh-huh)$/i
    if (ignoredPhrases.test(normalized)) {
      return
    }
    
    // Instant response for questions, quick response for statements
    const delay = isLikelyQuestion(lastTranscript.text) ? 0 : 100

    analysisTimeoutRef.current = setTimeout(async () => {
      // Double-check we're still listening before proceeding
      const state = useInterviewStore.getState()
      if (!state.isListening || !isMountedRef.current) {
        return
      }
      
      const snapshot = state.transcripts
      
      // Final check: abort if no longer listening
      if (!state.isListening) {
        return
      }
      
      const trimmedTranscripts =
        snapshot.length > MAX_TRANSCRIPTS_FOR_ANALYSIS
          ? snapshot.slice(-MAX_TRANSCRIPTS_FOR_ANALYSIS)
          : snapshot
      const { setIsAnalyzing, setError } = state
      
      // Verify we still have valid content
      const currentLastTranscript = trimmedTranscripts[trimmedTranscripts.length - 1]
      
      if (!currentLastTranscript || currentLastTranscript.text.trim().length < 5) {
        return
      }
      
      lastAnalysisTimeRef.current = Date.now() // Track analysis time
      
      setIsAnalyzing(true)
      setError(null)
      
      streamingResponseRef.current = ''
      streamingResponseIdRef.current = null

      try {
        perfMonitor.start('ai-analysis')
        const interviewContext = useInterviewStore.getState().interviewContext
        
        await analyzeWithStreaming(
          trimmedTranscripts,
          currentLanguageRef.current.split('-')[0],
          interviewContext,
          simpleEnglishRef.current,
          aiModelRef.current,
          (chunk: string) => {
            // Safety check: ensure component is still mounted AND still listening
            const currentState = useInterviewStore.getState()
            if (!isMountedRef.current || !currentState.isListening) {
              return
            }
            
            streamingResponseRef.current += chunk
            
            if (!streamingResponseIdRef.current) {
              streamingResponseIdRef.current = `answer-streaming-${Date.now()}`
              addAIResponse({
                id: streamingResponseIdRef.current,
                type: 'answer',
                content: streamingResponseRef.current,
                timestamp: Date.now(),
                confidence: 0.9,
              })
            } else {
              const { updateAIResponse } = useInterviewStore.getState()
              updateAIResponse(streamingResponseIdRef.current, {
                content: streamingResponseRef.current,
              })
            }
          },
          (responses) => {
            perfMonitor.end('ai-analysis')
            
            if (streamingResponseIdRef.current) {
              const { removeAIResponse } = useInterviewStore.getState()
              removeAIResponse(streamingResponseIdRef.current)
              streamingResponseIdRef.current = null
            }

            if (responses.length > 0) {
              responses.forEach((response) => {
                addAIResponse(response)
                
                if (autoSpeakRef.current && (response.type === 'answer' || response.type === 'suggestion')) {
                  speakText(response.content, currentLanguageRef.current)
                }
              })
            }
          },
          (errorMsg: string) => {
            setError(errorMsg || 'Failed to analyze conversation. Please check your API key.')
            setIsAnalyzing(false)
          }
        )
      } catch (error: any) {
        console.error('Analysis error:', error)
        setError(error.message || 'Failed to analyze conversation. Please check your API key.')
        setIsAnalyzing(false)
      } finally {
        setIsAnalyzing(false)
      }
    }, delay)
  }

  // Handle transcript from Deepgram
  const handleTranscript = (entry: TranscriptEntry) => {
    // Only update if speaker is interviewer or applicant (not system)
    if (entry.speaker === 'interviewer' || entry.speaker === 'applicant') {
      lastSpeakerRef.current = entry.speaker
    }

    const now = Date.now()
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || window.innerWidth < 768

    // ULTRA-FAST: Minimal timeout for real-time feel
    const bufferTimeout = isMobile ? 150 : 100 // Ultra-low latency for instant transcription

    if (transcriptBufferRef.current?.timeout) {
      clearTimeout(transcriptBufferRef.current.timeout)
    }

    const isCompleteSentence = (text: string): boolean => {
      const trimmed = text.trim()
      // Since we only process isFinal transcripts, trust Deepgram's detection
      // Just check if it's reasonable length or has clear ending
      const hasEndingPunctuation = /[.!?]\s*$/.test(trimmed)
      const isReasonableLength = trimmed.length > 5 // Just needs to be real content
      const isVeryLong = trimmed.length > 100 // Force commit if long
      return (hasEndingPunctuation && isReasonableLength) || isVeryLong
    }

    const commitBuffer = () => {
      if (transcriptBufferRef.current) {
        const bufferEntry: TranscriptEntry = {
          id: `transcript-${Date.now()}-${Math.random()}`,
          speaker: transcriptBufferRef.current.speaker,
          text: transcriptBufferRef.current.text.trim(),
          timestamp: transcriptBufferRef.current.timestamp,
        }
        addTranscript(bufferEntry)
        triggerAnalysis()
        transcriptBufferRef.current = null
      }
    }

    const isLikelyNoise = (text: string): boolean => {
      const trimmed = text.trim().toLowerCase()
      if (trimmed.length < 3) return true
      const fillerWords = ['uh', 'um', 'ah', 'eh', 'hmm', 'mm', 'er', 'well']
      if (fillerWords.includes(trimmed)) return true
      if (/^[^\w\s]+$/.test(trimmed)) return true
      return false
    }

    if (isLikelyNoise(entry.text)) {
      return
    }

    // Ensure speaker is interviewer or applicant (not system)
    const speaker = (entry.speaker === 'interviewer' || entry.speaker === 'applicant') 
      ? entry.speaker 
      : 'interviewer'

    if (transcriptBufferRef.current && transcriptBufferRef.current.speaker === speaker) {
      transcriptBufferRef.current.text += ' ' + entry.text.trim()
      transcriptBufferRef.current.lastChunkTime = now
      
      // Commit if sentence is complete OR text is long
      // Since isFinal is true, we can be more aggressive
      if (isCompleteSentence(transcriptBufferRef.current.text) || 
          transcriptBufferRef.current.text.length > 100) {
        commitBuffer()
        return
      }
    } else {
      if (transcriptBufferRef.current) {
        commitBuffer()
      }

      transcriptBufferRef.current = {
        text: entry.text.trim(),
        speaker: speaker,
        timestamp: now,
        timeout: null,
        lastChunkTime: now,
      }
    }

    if (transcriptBufferRef.current) {
      transcriptBufferRef.current.timeout = setTimeout(() => {
          if (transcriptBufferRef.current) {
            const timeSinceLastChunk = Date.now() - transcriptBufferRef.current.lastChunkTime
            // ULTRA-FAST: Minimal wait for real-time
            if (timeSinceLastChunk < 50) {
              transcriptBufferRef.current.timeout = setTimeout(() => {
                commitBuffer()
              }, 80) // Ultra-low latency
            } else {
              commitBuffer()
            }
          }
      }, bufferTimeout)
    }
  }

  // Handle start/stop listening
  useEffect(() => {
    if (isListening) {
      // Start Deepgram connection
      const language = currentLanguageRef.current || 'en-US'
      connect(language, handleTranscript)
    } else {
      // IMMEDIATE STOP: Cancel all ongoing operations first
      cancelStreaming()
      
      // Stop any speech synthesis immediately
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        speechSynthesis.cancel()
      }
      
      // Clear all analysis timeouts immediately
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current)
        analysisTimeoutRef.current = null
      }
      
      // Stop Deepgram connection (this stops microphone)
      disconnect()
      speakerDetectionService.resetHistory()
      
      // Clear any streaming response state
      if (streamingResponseIdRef.current) {
        const { removeAIResponse } = useInterviewStore.getState()
        removeAIResponse(streamingResponseIdRef.current)
        streamingResponseIdRef.current = null
      }
      streamingResponseRef.current = ''
      
      // Set analyzing to false immediately
      const { setIsAnalyzing, setError } = useInterviewStore.getState()
      setIsAnalyzing(false)
      setError(null) // Clear any error state too
      
      // Commit any pending buffer
      if (transcriptBufferRef.current) {
        if (transcriptBufferRef.current.timeout) {
          clearTimeout(transcriptBufferRef.current.timeout)
        }
        const entry: TranscriptEntry = {
          id: `transcript-${Date.now()}-${Math.random()}`,
          speaker: transcriptBufferRef.current.speaker,
          text: transcriptBufferRef.current.text.trim(),
          timestamp: transcriptBufferRef.current.timestamp,
        }
        addTranscript(entry)
        transcriptBufferRef.current = null
      }
    }

    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current)
      }
      if (transcriptBufferRef.current?.timeout) {
        clearTimeout(transcriptBufferRef.current.timeout)
      }
      cancelStreaming()
    }
  }, [isListening, connect, disconnect, addTranscript, cancelStreaming])

  const speakText = (text: string, lang: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang
      utterance.rate = 0.9
      utterance.pitch = 1.0
      speechSynthesis.speak(utterance)
    }
  }

  // Show connection status
  if (!isListening) {
    return null
  }

  if (!isConnected && !deepgramError) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
        <p className="text-blue-800 dark:text-blue-200 text-sm">
          🔄 Connecting to Deepgram...
        </p>
      </div>
    )
  }

  return null
}

