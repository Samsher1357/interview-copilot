'use client'

import { useEffect, useRef, useState } from 'react'
import { useInterviewStore, TranscriptEntry } from '@/lib/store'
import { aiService } from '@/lib/aiService'

export function AudioTranscriber() {
  const {
    isListening,
    currentLanguage,
    autoSpeak,
    addTranscript,
    addAIResponse,
    setIsListening,
    setError,
  } = useInterviewStore()

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const [isSupported, setIsSupported] = useState(false)
  const lastSpeakerRef = useRef<'interviewer' | 'applicant'>('interviewer')
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef = useRef(false)
  const isStartingRef = useRef(false)
  
  // Buffer for accumulating transcript chunks (to prevent sentence splitting on mobile)
  const transcriptBufferRef = useRef<{
    text: string
    speaker: 'interviewer' | 'applicant'
    timestamp: number
    timeout: NodeJS.Timeout | null
  } | null>(null)
  
  // Use refs to access latest values without recreating recognition
  const currentLanguageRef = useRef(currentLanguage)
  const autoSpeakRef = useRef(autoSpeak)
  
  useEffect(() => {
    currentLanguageRef.current = currentLanguage
    autoSpeakRef.current = autoSpeak
  }, [currentLanguage, autoSpeak])

  // Initialize recognition once
  useEffect(() => {
    // Check for browser support
    const SpeechRecognition = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setIsSupported(false)
      console.warn('Speech Recognition not supported in this browser')
      return
    }

    setIsSupported(true)
    
    // Only create recognition instance once
    if (!recognitionRef.current && !isInitializedRef.current) {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = currentLanguageRef.current

      recognition.onstart = () => {
        console.log('Speech recognition started')
        isStartingRef.current = false
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }

        // Process final transcript with buffering to prevent sentence splitting on mobile
        if (finalTranscript.trim()) {
          const speaker = aiService.detectSpeaker(
            finalTranscript,
            lastSpeakerRef.current
          )
          lastSpeakerRef.current = speaker

          // Clear any existing timeout for this buffer
          if (transcriptBufferRef.current?.timeout) {
            clearTimeout(transcriptBufferRef.current.timeout)
          }

          // If buffer exists and speaker is the same, accumulate text
          if (transcriptBufferRef.current && transcriptBufferRef.current.speaker === speaker) {
            transcriptBufferRef.current.text += ' ' + finalTranscript.trim()
            transcriptBufferRef.current.timestamp = Date.now()
          } else {
            // If speaker changed or no buffer, commit previous buffer first
            if (transcriptBufferRef.current) {
              const bufferedEntry: TranscriptEntry = {
                id: `transcript-${Date.now()}-${Math.random()}`,
                speaker: transcriptBufferRef.current.speaker,
                text: transcriptBufferRef.current.text.trim(),
                timestamp: transcriptBufferRef.current.timestamp,
              }
              addTranscript(bufferedEntry)
              triggerAnalysis()
            }

            // Start new buffer
            transcriptBufferRef.current = {
              text: finalTranscript.trim(),
              speaker,
              timestamp: Date.now(),
              timeout: null,
            }
          }

          // Set timeout to commit buffer after pause (600ms for mobile, prevents sentence splitting)
          transcriptBufferRef.current.timeout = setTimeout(() => {
            if (transcriptBufferRef.current) {
              const entry: TranscriptEntry = {
                id: `transcript-${Date.now()}-${Math.random()}`,
                speaker: transcriptBufferRef.current.speaker,
                text: transcriptBufferRef.current.text.trim(),
                timestamp: transcriptBufferRef.current.timestamp,
              }

              addTranscript(entry)
              triggerAnalysis()
              
              // Clear buffer
              transcriptBufferRef.current = null
            }
          }, 600) // Wait 600ms for more chunks before committing
        }
      }

      // Helper function to trigger AI analysis
      const triggerAnalysis = () => {
        // Trigger AI analysis immediately for real-time response
        if (analysisTimeoutRef.current) {
          clearTimeout(analysisTimeoutRef.current)
        }

        // Debounced delay for faster real-time response (200ms for better performance)
        analysisTimeoutRef.current = setTimeout(async () => {
          // Get current transcripts from store to ensure we have the latest
          const currentTranscripts = useInterviewStore.getState().transcripts
          const { setIsAnalyzing, setError } = useInterviewStore.getState()
          
          setIsAnalyzing(true)
          setError(null)
          
          try {
            const interviewContext = useInterviewStore.getState().interviewContext
            const responses = await aiService.analyzeConversation(
              currentTranscripts,
              currentLanguageRef.current.split('-')[0],
              interviewContext
            )

            if (responses.length > 0) {
              responses.forEach((response) => {
                addAIResponse(response)
                
                // Auto-speak if enabled (prioritize answers)
                if (autoSpeakRef.current && (response.type === 'answer' || response.type === 'suggestion')) {
                  speakText(response.content, currentLanguageRef.current)
                }
              })
            }
          } catch (error: any) {
            console.error('Analysis error:', error)
            setError(error.message || 'Failed to analyze conversation. Please check your API key.')
          } finally {
            setIsAnalyzing(false)
          }
        }, 200) // Optimized delay for faster response
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error)
        isStartingRef.current = false
        
        // Handle specific errors
        if (event.error === 'not-allowed') {
          setError('Microphone permission denied. Please allow microphone access.')
          setIsListening(false)
        } else if (event.error === 'no-speech' || event.error === 'audio-capture') {
          // These are common and can be ignored - don't stop listening
          return
        } else if (event.error === 'aborted') {
          // User stopped it, that's fine
          return
        } else {
          // For other errors, stop listening
          setIsListening(false)
        }
      }

      recognition.onend = () => {
        // Check current state from store (not closure)
        const currentState = useInterviewStore.getState()
        if (currentState.isListening && !isStartingRef.current) {
          // Restart recognition if still listening
          try {
            isStartingRef.current = true
            recognition.start()
          } catch (error: any) {
            console.error('Failed to restart recognition:', error)
            isStartingRef.current = false
            // Only stop if it's a real error, not if it's already running
            if (error.message && !error.message.includes('already started')) {
              setIsListening(false)
            }
          }
        }
      }

      recognitionRef.current = recognition
      isInitializedRef.current = true
    }

    return () => {
      // Cleanup on unmount only
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current)
      }
      if (transcriptBufferRef.current?.timeout) {
        clearTimeout(transcriptBufferRef.current.timeout)
      }
    }
  }, [addTranscript, addAIResponse, setIsListening, setError]) // Minimal dependencies

  // Update language when it changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = currentLanguageRef.current
    }
  }, [currentLanguage])

  // Handle start/stop listening
  useEffect(() => {
    if (!recognitionRef.current || !isSupported) return

    const recognition = recognitionRef.current

    if (isListening) {
      // Start recognition
      try {
        // Check if already started
        if (isStartingRef.current) return
        
        isStartingRef.current = true
        recognition.lang = currentLanguageRef.current
        
        // Small delay to ensure previous stop is complete
        setTimeout(() => {
          try {
            recognition.start()
          } catch (startError: any) {
            isStartingRef.current = false
            console.error('Failed to start recognition:', startError)
            // If already started, that's okay - sync state
            if (startError.message && startError.message.includes('already started')) {
              return
            }
            setIsListening(false)
            setError('Failed to start listening. Please check microphone permissions.')
          }
        }, 100)
      } catch (error: any) {
        isStartingRef.current = false
        console.error('Failed to prepare recognition:', error)
        setIsListening(false)
        setError('Failed to start listening. Please check microphone permissions.')
      }
    } else {
      // Stop recognition
      try {
        isStartingRef.current = false
        
        // Commit any pending buffer before stopping
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
        
        recognition.stop()
      } catch (error: any) {
        console.error('Failed to stop recognition:', error)
        // Try to abort as fallback
        try {
          recognition.abort()
        } catch (abortError) {
          console.error('Failed to abort recognition:', abortError)
        }
      }
    }
  }, [isListening, isSupported, setIsListening, setError])

  const speakText = (text: string, lang: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang
      utterance.rate = 0.9
      utterance.pitch = 1.0
      speechSynthesis.speak(utterance)
    }
  }

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-4">
        <p className="text-yellow-800 dark:text-yellow-200 text-sm">
          ⚠️ Speech Recognition is not supported in your browser. 
          Please use Chrome, Edge, or Safari for the best experience.
        </p>
      </div>
    )
  }

  return null
}

