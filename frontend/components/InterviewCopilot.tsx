'use client'

import { useEffect, useState } from 'react'
import { useInterviewStore } from '@/lib/store'
import { DeepgramTranscriber } from './DeepgramTranscriber'
import { TranscriptPanel } from './TranscriptPanel'
import { OptimizedResponsePanel } from './OptimizedResponsePanel'
import { ControlPanel } from './ControlPanel'
import { ErrorDisplay } from './ErrorDisplay'
import { ContextModal } from './ContextModal'
import { FileText, Volume2, VolumeX, Settings } from 'lucide-react'

export function InterviewCopilot() {
  const {
    isListening,
    autoSpeak,
    simpleEnglish,
    error,
    isAnalyzing,
    interviewContext,
    setAutoSpeak,
    setSimpleEnglish,
    setError,
    setShowContextModal,
  } = useInterviewStore()

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only if not typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Ctrl+K: Open context settings
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowContextModal(true)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [setShowContextModal])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
        {/* Minimal Header */}
        <div className="mb-3 sm:mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI Interview Copilot
            </h1>
          </div>
          <button
            onClick={() => setShowContextModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              Object.keys(interviewContext).length > 0 && (interviewContext.jobRole || interviewContext.company)
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Context</span>
          </button>
        </div>

        {/* Main Layout - Modern Split View */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Left Column - Transcript (40%) */}
          <div className="lg:col-span-2 flex flex-col space-y-3 sm:space-y-4">
            <ControlPanel />
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-4 sm:p-5 flex-1 flex flex-col min-h-[250px] sm:min-h-[300px] lg:min-h-[400px]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                  Conversation
                </h2>
                <button
                  onClick={() => setSimpleEnglish(!simpleEnglish)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    simpleEnglish
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  title={simpleEnglish ? 'Simple English enabled' : 'Simple English disabled'}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Simple</span>
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <TranscriptPanel />
              </div>
            </div>
          </div>

          {/* Right Column - AI Answers (60%) */}
          <div className="lg:col-span-3">
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-4 sm:p-6 lg:sticky lg:top-3 h-[calc(100vh-2rem)] lg:h-[calc(100vh-1.5rem)] flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                    AI Answer
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Most recent response
                  </p>
                  {isAnalyzing && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
                      Analyzing...
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setAutoSpeak(!autoSpeak)}
                  className={`p-2 rounded-lg transition-all ${
                    autoSpeak
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title={autoSpeak ? 'Auto-speak enabled' : 'Auto-speak disabled'}
                >
                  {autoSpeak ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <OptimizedResponsePanel />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audio Transcriber Component - Using Deepgram for better accuracy */}
      <DeepgramTranscriber />
      
      {/* Error Display */}
      <ErrorDisplay error={error} onDismiss={() => setError(null)} />
      
      {/* Context Modal */}
      <ContextModal />
      
    </div>
  )
}

