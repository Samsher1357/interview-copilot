'use client'

import { useEffect, useState, useRef } from 'react'
import { useInterviewStore } from '@/lib/store'
import { Mic, MicOff, Sparkles, Copy, Trash2, Settings, LogOut } from 'lucide-react'
import { DeepgramTranscriber } from './DeepgramTranscriber'
import { useSocketAnalysis } from '@/lib/hooks/useSocketAnalysis'
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

  const { analyzeWithStreaming, cancel: cancelStreaming } = useSocketAnalysis()
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

  // Auto-scroll transcript only
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [fullTranscript])

  // DISABLED: Auto-scroll answer for better readability
  // Users can manually scroll to read at their own pace

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
      navigator.clipboard.writeText(latestAnswer.content).then(() => {
        const { showToast } = useInterviewStore.getState()
        showToast('success', 'Copied!', 'Answer copied to clipboard')
      }).catch(() => {
        const { showToast } = useInterviewStore.getState()
        showToast('error', 'Copy failed', 'Failed to copy to clipboard')
      })
    }
  }

  const handleClear = () => {
    if (confirm('Clear all transcripts and responses?')) {
      clearTranscripts()
      clearResponses()
      const { showToast } = useInterviewStore.getState()
      showToast('success', 'Cleared', 'All transcripts and responses have been cleared')
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
      
      const { showToast } = useInterviewStore.getState()
      showToast('info', 'Session Ended', 'Your interview session has been ended')
      
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
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold text-gradient mb-1">
                AI Interview Copilot
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Real-time interview assistance powered by AI
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBackToSetup}
                className="p-2 sm:p-2.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                title="Settings"
                aria-label="Open settings"
              >
                <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <button
                onClick={handleEndSession}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 text-red-600 dark:text-red-400 hover:text-white hover:bg-red-600 dark:hover:bg-red-500 border border-red-300 dark:border-red-600 rounded-lg transition-all font-medium text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                title="End Session"
                aria-label="End interview session"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">End</span>
              </button>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={handleToggleListening}
              className={`flex items-center gap-2 px-5 sm:px-8 py-3 sm:py-3.5 rounded-xl font-semibold text-white transition-all transform active:scale-95 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[44px] ${
                isListening
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 focus:ring-red-500'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500'
              }`}
              aria-label={isListening ? 'Stop recording' : 'Start recording'}
            >
              {isListening ? (
                <>
                  <MicOff className="w-5 h-5" />
                  <span className="text-sm sm:text-base">Stop</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  <span className="text-sm sm:text-base">Record</span>
                </>
              )}
            </button>

            <button
              onClick={handleManualAnalysis}
              disabled={isManualAnalyzing || isAnalyzing || transcripts.length === 0}
              className={`flex items-center gap-2 px-5 sm:px-8 py-3 sm:py-3.5 rounded-xl font-semibold transition-all transform active:scale-95 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[44px] ${
                isManualAnalyzing || isAnalyzing || transcripts.length === 0
                  ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white focus:ring-purple-500'
              }`}
              aria-label="Get AI answer"
            >
              <Sparkles className="w-5 h-5" />
              <span className="text-sm sm:text-base">Analyze</span>
            </button>

            <button
              onClick={handleClear}
              className="p-3 sm:p-3.5 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 min-h-[44px] min-w-[44px]"
              title="Clear all"
              aria-label="Clear all transcripts and responses"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          {/* Status Indicators */}
          {(isListening || questionDetected || isAnalyzing || isManualAnalyzing) && (
            <div className="mt-4 flex items-center justify-center gap-3 flex-wrap animate-fade-in">
              {isListening && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-xs sm:text-sm font-medium text-red-700 dark:text-red-400">Recording</span>
                </div>
              )}
              {questionDetected && !isAnalyzing && !isManualAnalyzing && (
                <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
                  <span className="text-xs sm:text-sm font-medium text-purple-700 dark:text-purple-400">Question Detected</span>
                </div>
              )}
              {(isAnalyzing || isManualAnalyzing) && (
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-400">AI Thinking...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
          {/* Transcript Section */}
          <div className="lg:col-span-2 card animate-slide-up">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 py-3 sm:py-4 rounded-t-xl">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                Question
              </h2>
            </div>
            <div
              ref={transcriptRef}
              className="p-4 sm:p-6 h-[120px] sm:h-[200px] lg:h-[calc(100vh-400px)] overflow-y-auto scrollbar-thin"
            >
              {fullTranscript ? (
                <p className="text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-relaxed">
                  {fullTranscript}
                </p>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Mic className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                      Click "Record" to start
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Answer Section */}
          <div className="lg:col-span-3 card animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-4 sm:px-6 py-3 sm:py-4 rounded-t-xl flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                AI Answer
              </h2>
              {latestAnswer && (
                <button
                  onClick={handleCopyAnswer}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-white/50"
                  title="Copy answer"
                  aria-label="Copy answer to clipboard"
                >
                  <Copy className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
            <div
              ref={answerRef}
              className="p-4 sm:p-6 h-[calc(100vh-420px)] sm:h-[400px] lg:h-[calc(100vh-400px)] overflow-y-auto scrollbar-thin"
            >
              {latestAnswer ? (
                <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
                  <FormattedContent content={latestAnswer.content} />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Sparkles className="w-12 h-12 sm:w-16 sm:h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-600 dark:text-slate-400 font-medium mb-2 text-sm sm:text-base">
                      AI answers appear here
                    </p>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-500 max-w-xs mx-auto">
                      Questions are auto-detected or click "Analyze" to get an answer
                    </p>
                  </div>
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
