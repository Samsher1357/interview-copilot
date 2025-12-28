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
  const streamingResponseRef = useRef<string>('')
  const streamingResponseIdRef = useRef<string | null>(null)
  const [isManualAnalyzing, setIsManualAnalyzing] = useState(false)

  // Combine all transcript text into one continuous string
  const fullTranscript = transcripts.map(t => t.text).join(' ')

  // Get the latest answer
  const latestAnswer = aiResponses.length > 0 
    ? [...aiResponses].sort((a, b) => b.timestamp - a.timestamp)[0]
    : null

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
      analyzeWithStreaming(
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
      // Cancel any ongoing streaming analysis
      cancelStreaming()
      
      // Clear streaming refs
      streamingResponseRef.current = ''
      if (streamingResponseIdRef.current) {
        const { removeAIResponse } = useInterviewStore.getState()
        removeAIResponse(streamingResponseIdRef.current)
        streamingResponseIdRef.current = null
      }
      
      // Stop manual analyzing state
      setIsManualAnalyzing(false)
      
      // Stop listening if active (this will trigger DeepgramTranscriber cleanup)
      if (isListening) {
        setIsListening(false)
      }
      
      // Clear all data
      clearTranscripts()
      clearResponses()
      setError(null)
      
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gradient mb-0.5">
                AI Interview Copilot
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400">
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
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={handleToggleListening}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-semibold text-white transition-all transform active:scale-95 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[40px] text-sm ${
                isListening
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 focus:ring-red-500'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500'
              }`}
              aria-label={isListening ? 'Stop recording' : 'Start recording'}
            >
              {isListening ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>Record</span>
                </>
              )}
            </button>

            <button
              onClick={handleManualAnalysis}
              disabled={isManualAnalyzing || isAnalyzing || transcripts.length === 0}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-semibold transition-all transform active:scale-95 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[40px] text-sm ${
                isManualAnalyzing || isAnalyzing || transcripts.length === 0
                  ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white focus:ring-purple-500'
              }`}
              aria-label="Get AI answer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Analyze</span>
            </button>

            <button
              onClick={handleClear}
              className="p-2 sm:p-2.5 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 min-h-[40px] min-w-[40px]"
              title="Clear all"
              aria-label="Clear all transcripts and responses"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Status Indicators */}
          {(isListening || isAnalyzing || isManualAnalyzing) && (
            <div className="mt-3 flex items-center justify-center gap-2 flex-wrap animate-fade-in">
              {isListening && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-red-700 dark:text-red-400">Recording</span>
                </div>
              )}
              {(isAnalyzing || isManualAnalyzing) && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-400">AI Thinking...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
          {/* Transcript Section - Ultra Minimized */}
          <div className="lg:col-span-2 card animate-slide-up">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-t-xl">
              <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <div className="w-1 h-1 bg-white rounded-full"></div>
                Question
              </h2>
            </div>
            <div
              ref={transcriptRef}
              className="p-2 sm:p-3 h-[80px] sm:h-[100px] lg:h-[calc(100vh-380px)] overflow-y-auto scrollbar-thin text-xs leading-snug"
            >
              {fullTranscript ? (
                <p className="text-slate-900 dark:text-slate-100">
                  {fullTranscript}
                </p>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Mic className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
                    <p className="text-slate-500 dark:text-slate-400 text-xs">
                      Record
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Answer Section - Maximum Space */}
          <div className="lg:col-span-10 card animate-slide-up" style={{ animationDelay: '0.1s' }}>
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
              className="p-4 sm:p-6 h-[calc(100vh-280px)] lg:h-[calc(100vh-320px)] overflow-y-auto scrollbar-thin"
            >
              {latestAnswer ? (
                <FormattedContent content={latestAnswer.content} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-600 dark:text-slate-400 font-medium mb-1 text-sm">
                      AI answers appear here
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 max-w-xs mx-auto">
                      Click "Analyze" to get an answer
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
