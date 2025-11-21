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
    userRole,
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
  const MAX_TRANSCRIPTS_FOR_ANALYSIS = 10 // Reduced from 12 for faster processing
  const questionPattern = /\b(what|why|how|when|where|who|which|could you|would you|can you|tell me|describe|explain|walk me through|give me)\b/i
  const lastAnalysisTimeRef = useRef(0)
  const MIN_ANALYSIS_INTERVAL = 800 // Minimum 800ms between analyses (reduced from implicit longer delay)

  useEffect(() => {
    currentLanguageRef.current = currentLanguage
    autoSpeakRef.current = autoSpeak
    simpleEnglishRef.current = simpleEnglish
  }, [currentLanguage, autoSpeak, simpleEnglish])

  // Handle Deepgram errors
  useEffect(() => {
    if (deepgramError) {
      setError(deepgramError)
    }
  }, [deepgramError, setError])

  const isLikelyQuestion = (text: string) => {
    const normalized = text.trim().toLowerCase()
    if (!normalized) return false
    if (normalized.endsWith('?')) return true
    return questionPattern.test(normalized)
  }

  // OPTIMIZED: Helper function to trigger AI analysis with smart throttling
  const triggerAnalysis = () => {
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

    // ULTRA-FAST: Immediate trigger for instant response
    const currentTranscripts = useInterviewStore.getState().transcripts
    const delay = currentTranscripts.length <= 1 ? 0 : 30 // Ultra-low delay for real-time feel

    analysisTimeoutRef.current = setTimeout(async () => {
      const snapshot = useInterviewStore.getState().transcripts
      const trimmedTranscripts =
        snapshot.length > MAX_TRANSCRIPTS_FOR_ANALYSIS
          ? snapshot.slice(-MAX_TRANSCRIPTS_FOR_ANALYSIS)
          : snapshot
      const { setIsAnalyzing, setError, userRole } = useInterviewStore.getState()
      
      // Always analyze both interviewer and applicant speech
      // This helps the applicant in real-time:
      // - Interviewer speaks: Show answer suggestions
      // - Applicant speaks: Show feedback/improvements
      const lastTranscript = trimmedTranscripts[trimmedTranscripts.length - 1]
      
      if (!lastTranscript) {
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
          userRole,
          simpleEnglishRef.current,
          (chunk: string) => {
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
      // Stop Deepgram connection
      disconnect()
      speakerDetectionService.resetHistory()
      
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

