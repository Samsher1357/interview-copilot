'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Mic,
  MicOff,
  Sparkles,
  Copy,
  Trash2,
  Settings,
  LogOut,
  Loader2,
  ChevronUp,
  ChevronDown
} from 'lucide-react'

import { useInterviewStore } from '@/lib/store'
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

  /* -------------------- SETUP -------------------- */
  const hasCompletedSetup = !!(
    interviewContext.jobRole ||
    interviewContext.company ||
    interviewContext.skills?.length
  )

  const [showSetup, setShowSetup] = useState(!hasCompletedSetup)
  const [showTranscript, setShowTranscript] = useState(false)

  /* -------------------- STREAMING -------------------- */
  const { analyzeWithStreaming, cancel } = useSocketAnalysis()
  const streamingRef = useRef('')
  const streamingIdRef = useRef<string | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  /* -------------------- DERIVED -------------------- */
  const fullTranscript = useMemo(
    () => transcripts.map(t => t.text).join(' '),
    [transcripts]
  )

  const latestAnswer = useMemo(() => {
    if (aiResponses.length === 0) return null;
    return [...aiResponses].sort((a, b) => b.timestamp - a.timestamp)[0];
  }, [aiResponses])

  const isGenerating = isAnalyzing || !!streamingIdRef.current

  /**
   * TRANSCRIPT AUTO-SCROLL
   * We keep this because the transcript is a small secondary window.
   */
  useEffect(() => {
    if (showTranscript && transcriptRef.current) {
      transcriptRef.current.scrollTo({
        top: transcriptRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [fullTranscript, showTranscript])

  /* -------------------- ACTIONS -------------------- */
  const handleAnalyze = async () => {
    if (!transcripts.length || isAnalyzing || streamingIdRef.current) return

    setError(null)
    cancel()

    streamingRef.current = ''
    streamingIdRef.current = `stream-${Date.now()}`

    // Optimistically add the streaming placeholder to the store
    addAIResponse({
      id: streamingIdRef.current,
      type: 'answer',
      content: '',
      timestamp: Date.now(),
      confidence: 0.9
    })

    analyzeWithStreaming(
      transcripts.slice(-8),
      currentLanguage.split('-')[0],
      interviewContext,
      simpleEnglish,
      aiModel,
      chunk => {
        streamingRef.current += chunk
        // Directly update the store to reflect streaming text
        useInterviewStore.getState().updateAIResponse(streamingIdRef.current!, {
          content: streamingRef.current
        })
      },
      responses => {
        if (streamingIdRef.current) {
          useInterviewStore.getState().removeAIResponse(streamingIdRef.current)
        }
        responses.forEach(addAIResponse)
        streamingIdRef.current = null
      },
      err => {
        setError(err)
        if (streamingIdRef.current) {
            useInterviewStore.getState().removeAIResponse(streamingIdRef.current)
        }
        streamingIdRef.current = null
      }
    )
  }

  const handleEnd = () => {
    if (!confirm('End session and clear everything?')) return
    cancel()
    setIsListening(false)
    clearResponses()
    clearTranscripts()
    streamingIdRef.current = null
    setShowSetup(true)
  }

  if (showSetup) return <SetupScreen onStart={() => setShowSetup(false)} />

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      {/* ================= HEADER ================= */}
      <header className="flex-none bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 z-30 relative">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg font-bold truncate">AI Interview Copilot</h1>
              <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                {interviewContext.jobRole || 'Real-time assistance'}
              </p>
            </div>
            {isListening && (
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-full flex-shrink-0">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-red-700 dark:text-red-400">Live</span>
              </div>
            )}
          </div>

          <div className="flex gap-1 sm:gap-2 flex-shrink-0">
            <button 
              onClick={() => setShowSetup(true)} 
              className="p-1.5 sm:p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition touch-manipulation"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
            </button>
            <button 
              onClick={handleEnd} 
              className="p-1.5 sm:p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition text-red-500 touch-manipulation"
              aria-label="End session"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT (MANUAL SCROLL) ================= */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 scroll-smooth relative z-10">
        <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4 pb-40 sm:pb-44">
          
          {/* -------- TRANSCRIPT (COLLAPSIBLE) -------- */}
          <section className="bg-white dark:bg-slate-900 rounded-lg sm:rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 flex justify-between items-center text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition touch-manipulation active:scale-[0.98]"
            >
              <span className="flex items-center gap-2">
                <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 flex-shrink-0" /> 
                <span>Transcript</span>
                {transcripts.length > 0 && (
                  <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                    {transcripts.length}
                  </span>
                )}
              </span>
              {showTranscript ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />}
            </button>

            {showTranscript && (
              <div
                ref={transcriptRef}
                className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-h-40 sm:max-h-48 overflow-y-auto border-t border-slate-100 dark:border-slate-800 scrollbar-thin"
              >
                {fullTranscript ? (
                  <p className="leading-relaxed">{fullTranscript}</p>
                ) : (
                  <p className="text-slate-400 dark:text-slate-500 italic">Waiting for speech...</p>
                )}
              </div>
            )}
          </section>

          {/* -------- AI ANSWER SECTION -------- */}
          <section className="bg-white dark:bg-slate-900 rounded-lg sm:rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 min-h-[350px] sm:min-h-[450px] relative">
            {/* Sticky sub-header for the answer box */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 backdrop-blur-sm px-3 sm:px-4 py-2.5 sm:py-3 flex justify-between items-center border-b border-slate-200 dark:border-slate-700 rounded-t-lg sm:rounded-t-xl z-10">
              <h2 className="text-sm sm:text-base font-bold flex items-center gap-1.5 sm:gap-2 text-slate-800 dark:text-slate-100">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 flex-shrink-0" />
                <span>AI Answer</span>
              </h2>
              {latestAnswer && !isGenerating && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(latestAnswer.content)
                    // Optional: Show a toast notification
                  }}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium bg-white dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-slate-600 rounded-md sm:rounded-lg transition shadow-sm border border-slate-200 dark:border-slate-600 touch-manipulation active:scale-95"
                  aria-label="Copy answer"
                >
                  <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> 
                  <span className="hidden xs:inline">Copy</span>
                </button>
              )}
            </div>

            <div className="p-4 sm:p-6">
              {latestAnswer ? (
                <div className="prose dark:prose-invert max-w-none prose-sm sm:prose-base">
                  <FormattedContent content={latestAnswer.content} />
                  {isGenerating && (
                    <span className="inline-block w-1 sm:w-1.5 h-4 sm:h-5 ml-1 sm:ml-2 bg-blue-500 animate-pulse align-middle rounded-sm" />
                  )}
                </div>
              ) : isGenerating ? (
                <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-slate-500">
                  <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin mb-3 sm:mb-4 text-blue-500" />
                  <p className="text-base sm:text-lg font-medium text-slate-700 dark:text-slate-300">Generating response...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 sm:py-20">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 rounded-full flex items-center justify-center mb-3 sm:mb-4 shadow-inner">
                    <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400 dark:text-slate-500" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-center text-sm sm:text-lg px-4">
                    Speak into the mic, then tap <span className="text-blue-600 dark:text-blue-400 font-semibold">Analyze</span>
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* ================= FIXED BOTTOM BAR ================= */}
      <footer className="flex-none bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t-2 border-slate-300 dark:border-slate-700 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_-8px_30px_rgb(0,0,0,0.5)] z-40 relative">
        <div className="max-w-4xl mx-auto flex gap-2 sm:gap-3">
          <button
            onClick={() => setIsListening(!isListening)}
            className={`flex-1 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-center gap-2 sm:gap-3 text-base sm:text-lg font-bold transition-all touch-manipulation active:scale-95 ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200 dark:shadow-none ring-2 sm:ring-4 ring-red-50 dark:ring-red-900/10'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 dark:shadow-none'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> 
                <span className="hidden xs:inline">Stop</span>
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 sm:w-6 sm:h-6" /> 
                <span className="hidden xs:inline">Record</span>
              </>
            )}
          </button>

          <button
            onClick={handleAnalyze}
            disabled={isGenerating || transcripts.length === 0}
            className={`flex-1 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-center gap-2 sm:gap-3 text-base sm:text-lg font-bold transition-all touch-manipulation active:scale-95 ${
              isGenerating || transcripts.length === 0
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white hover:opacity-90 shadow-lg'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> 
                <span className="hidden xs:inline">Analyzing</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" /> 
                <span className="hidden xs:inline">Analyze</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              if (confirm('Clear current session?')) {
                clearResponses()
                clearTranscripts()
                streamingIdRef.current = null
              }
            }}
            className="rounded-xl sm:rounded-2xl px-3 sm:px-5 py-3 sm:py-4 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 group transition touch-manipulation active:scale-95 flex items-center justify-center"
            aria-label="Clear all"
          >
            <Trash2 className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 group-hover:text-red-500 transition-colors" />
          </button>
        </div>
      </footer>

      <DeepgramTranscriber />
      <ErrorDisplay error={error} onDismiss={() => setError(null)} />
    </div>
  )
}