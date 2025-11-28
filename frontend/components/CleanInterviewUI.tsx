'use client'

import { useEffect, useState, useRef } from 'react'
import { useInterviewStore } from '@/lib/store'
import { Mic, MicOff, Sparkles, Copy, Trash2, Settings, LogOut } from 'lucide-react'
import { DeepgramTranscriber } from './DeepgramTranscriber'
import { useStreamingAnalysis } from '@/lib/hooks/useStreamingAnalysis'
import { FormattedContent } from './FormattedContent'
import { ErrorDisplay } from './ErrorDisplay'
import { SetupScreen } from './SetupScreen'

export function CleanInterviewUI() {
  const {
    isListening,
    transcripts,
    aiResponses,
    isAnalyzing,
    currentLanguage,
    aiModel,
    error,
    setIsListening,
    setError,
    clearTranscripts,
    clearResponses,
    addAIResponse,
    interviewContext,
    simpleEnglish
  } = useInterviewStore()
  
  // Check if user has completed setup before
  const hasCompletedSetup = !!(
    interviewContext.jobRole || 
    interviewContext.company || 
    (interviewContext.skills && interviewContext.skills.length > 0)
  )
  
  const [showSetup, setShowSetup] = useState(!hasCompletedSetup)

  const { analyzeWithStreaming, cancel: cancelStreaming } = useStreamingAnalysis()
  const transcriptRef = useRef<HTMLDivElement>(null)
  const answerRef = useRef<HTMLDivElement>(null)
  const streamingResponseRef = useRef<string>('')
  const streamingResponseIdRef = useRef<string | null>(null)
  const [isManualAnalyzing, setIsManualAnalyzing] = useState(false)
  const [questionDetected, setQuestionDetected] = useState(false)

  // Combine all transcript text into one continuous string
  const fullTranscript = transcripts.map(t => t.text).join(' ')

  // Get the latest answer
  const latestAnswer = aiResponses.length > 0 
    ? [...aiResponses].sort((a, b) => b.timestamp - a.timestamp)[0]
    : null

  // Smart question detection
  const isLikelyQuestion = (text: string) => {
    const normalized = text.trim().toLowerCase()
    if (!normalized) return false
    if (normalized.endsWith('?')) return true
    
    const questionStarters = /^(what|why|how|when|where|who|which|can you|could you|would you|will you|do you|tell me|describe|explain|walk me through|give me)/i
    if (questionStarters.test(normalized)) return true
    
    const interviewPatterns = [
      /tell me (about|more)/i,
      /describe (your|how|the)/i,
      /explain (how|why|what|the)/i,
      /walk me through/i,
      /give me (an? )?example/i,
    ]
    
    return interviewPatterns.some(pattern => pattern.test(normalized))
  }

  // Detect meaningful speech in transcript
  useEffect(() => {
    if (transcripts.length > 0) {
      const lastTranscript = transcripts[transcripts.length - 1]
      const text = lastTranscript.text.trim()
      
      // Check if it's meaningful content (not just filler words)
      const ignoredPhrases = /^(ok|okay|yes|no|yeah|yep|nope|uh|um|hmm|ah|eh|right|sure|mhm|uh-huh)$/i
      const isMeaningful = text.length >= 5 && !ignoredPhrases.test(text.toLowerCase())
      
      if (isMeaningful) {
        const detected = isLikelyQuestion(text)
        setQuestionDetected(detected)
        
        // Auto-hide after 2 seconds
        const timer = setTimeout(() => setQuestionDetected(false), 2000)
        return () => clearTimeout(timer)
      }
    }
  }, [transcripts])

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [fullTranscript])

  // Auto-scroll answer
  useEffect(() => {
    if (answerRef.current) {
      answerRef.current.scrollTop = answerRef.current.scrollHeight
    }
  }, [latestAnswer?.content])

  const handleToggleListening = () => {
    setIsListening(!isListening)
  }

  const handleManualAnalysis = async () => {
    if (transcripts.length === 0) {
      setError('No transcript to analyze. Please start recording first.')
      return
    }

    if (isManualAnalyzing || isAnalyzing) {
      return
    }

    setIsManualAnalyzing(true)
    setError(null)
    cancelStreaming()
    streamingResponseRef.current = ''
    streamingResponseIdRef.current = null

    try {
      await analyzeWithStreaming(
        transcripts.slice(-8), // Use last 8 transcripts
        currentLanguage.split('-')[0],
        interviewContext,
        simpleEnglish,
        aiModel,
        (chunk: string) => {
          streamingResponseRef.current += chunk
          
          if (!streamingResponseIdRef.current) {
            streamingResponseIdRef.current = `answer-manual-${Date.now()}`
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
          if (streamingResponseIdRef.current) {
            const { removeAIResponse } = useInterviewStore.getState()
            removeAIResponse(streamingResponseIdRef.current)
            streamingResponseIdRef.current = null
          }

          if (responses.length > 0) {
            responses.forEach((response) => {
              addAIResponse(response)
            })
          }
        },
        (errorMsg: string) => {
          setError(errorMsg || 'Failed to analyze conversation.')
          setIsManualAnalyzing(false)
        }
      )
    } catch (error: any) {
      console.error('Manual analysis error:', error)
      setError(error.message || 'Failed to analyze conversation.')
    } finally {
      setIsManualAnalyzing(false)
    }
  }

  const handleCopyAnswer = () => {
    if (latestAnswer) {
      navigator.clipboard.writeText(latestAnswer.content)
    }
  }

  const handleClear = () => {
    if (confirm('Clear all transcripts and responses?')) {
      clearTranscripts()
      clearResponses()
    }
  }

  const handleEndSession = () => {
    if (confirm('End this interview session? All data will be cleared and you will return to setup.')) {
      // Stop listening if active
      if (isListening) {
        setIsListening(false)
      }
      
      // Clear all data
      clearTranscripts()
      clearResponses()
      
      // Return to setup screen
      setShowSetup(true)
    }
  }

  const handleBackToSetup = () => {
    if (isListening) {
      setIsListening(false)
    }
    setShowSetup(true)
  }

  // Show setup screen first
  if (showSetup) {
    return <SetupScreen onStart={() => setShowSetup(false)} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              AI Interview Copilot
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your intelligent interview assistant
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackToSetup}
              className="p-3 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
              title="Settings"
            >
              <Settings className="w-6 h-6" />
            </button>
            <button
              onClick={handleEndSession}
              className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:text-white hover:bg-red-600 dark:hover:bg-red-500 border border-red-600 dark:border-red-400 rounded-xl transition-all font-medium text-sm"
              title="End Session"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">End Session</span>
            </button>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="mb-6 flex items-center justify-center gap-4 flex-wrap">
          <button
            onClick={handleToggleListening}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all transform active:scale-95 shadow-lg ${
              isListening
                ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-5 h-5" />
                <span>Stop Recording</span>
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                <span>Start Recording</span>
              </>
            )}
          </button>

          <button
            onClick={handleManualAnalysis}
            disabled={isManualAnalyzing || isAnalyzing || transcripts.length === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all transform active:scale-95 shadow-lg ${
              isManualAnalyzing || isAnalyzing || transcripts.length === 0
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span>Get AI Answer</span>
          </button>

          <button
            onClick={handleClear}
            className="p-3 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
            title="Clear all"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {/* Status Indicators */}
        <div className="mb-4 flex items-center justify-center gap-4 flex-wrap">
          {isListening && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-red-700 dark:text-red-400">Recording</span>
            </div>
          )}
          {questionDetected && !isAnalyzing && !isManualAnalyzing && (
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-400">Analyzing...</span>
            </div>
          )}
          {(isAnalyzing || isManualAnalyzing) && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="w-2 h-2 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">AI Thinking...</span>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="space-y-4">
          {/* Transcript Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                Question
              </h2>
            </div>
            <div
              ref={transcriptRef}
              className="p-6 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
            >
              {fullTranscript ? (
                <p className="text-gray-900 dark:text-gray-100 text-lg leading-relaxed">
                  {fullTranscript}
                </p>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  Click "Start Recording" to begin transcribing...
                </p>
              )}
            </div>
          </div>

          {/* Answer Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Answer
              </h2>
              {latestAnswer && (
                <button
                  onClick={handleCopyAnswer}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all"
                  title="Copy answer"
                >
                  <Copy className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
            <div
              ref={answerRef}
              className="p-6 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
            >
              {latestAnswer ? (
                <div className="text-gray-900 dark:text-gray-100 text-base leading-relaxed">
                  <FormattedContent content={latestAnswer.content} />
                </div>
              ) : (
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium mb-2">
                    AI answers will appear here
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Questions are auto-detected or click "Get AI Answer"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Audio Transcriber Component */}
      <DeepgramTranscriber />
      
      {/* Error Display */}
      <ErrorDisplay error={error} onDismiss={() => setError(null)} />
    </div>
  )
}
