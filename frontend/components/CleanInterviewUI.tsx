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
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* ================= HEADER ================= */}
      <header className="flex-none bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold">AI Interview Copilot</h1>
              <p className="text-xs text-slate-500">
                {interviewContext.jobRole || 'Real-time assistance'}
              </p>
            </div>
            {isListening && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-700 dark:text-red-400">Live</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowSetup(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
              <Settings className="w-5 h-5 text-slate-500" />
            </button>
            <button onClick={handleEnd} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition text-red-500">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT (MANUAL SCROLL) ================= */}
      <main className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth">
        <div className="max-w-4xl mx-auto space-y-4 pb-32">
          
          {/* -------- TRANSCRIPT (COLLAPSIBLE) -------- */}
          <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="w-full px-4 py-3 flex justify-between items-center text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <span className="flex items-center gap-2">
                <Mic className="w-4 h-4" /> Transcript
              </span>
              {showTranscript ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {showTranscript && (
              <div
                ref={transcriptRef}
                className="px-4 pb-4 pt-2 text-sm text-slate-600 dark:text-slate-400 max-h-48 overflow-y-auto border-t border-slate-50 dark:border-slate-800"
              >
                {fullTranscript || (
                  <p className="text-slate-400 italic">Waiting for speech...</p>
                )}
              </div>
            )}
          </section>

          {/* -------- AI ANSWER SECTION -------- */}
          <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 min-h-[450px] relative">
            {/* Sticky sub-header for the answer box */}
            <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-4 py-3 flex justify-between items-center border-b border-slate-200 dark:border-slate-800 rounded-t-xl z-20">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                AI Answer
              </h2>
              {latestAnswer && !isGenerating && (
                <button
                  onClick={() => navigator.clipboard.writeText(latestAnswer.content)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
              )}
            </div>

            <div className="p-6">
              {latestAnswer ? (
                <div className="prose dark:prose-invert max-w-none">
                  <FormattedContent content={latestAnswer.content} />
                  {isGenerating && (
                    <span className="inline-block w-1.5 h-5 ml-2 bg-blue-500 animate-pulse align-middle" />
                  )}
                </div>
              ) : isGenerating ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
                  <p className="text-lg font-medium">Generating response...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-400 text-center text-lg">
                    Speak into the mic, then tap <span className="text-blue-600 font-semibold">Analyze</span>
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* ================= FIXED BOTTOM BAR ================= */}
      <footer className="flex-none bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgb(0,0,0,0.04)] z-50">
        <div className="max-w-4xl mx-auto flex gap-3">
          <button
            onClick={() => setIsListening(!isListening)}
            className={`flex-1 rounded-2xl px-6 py-4 flex items-center justify-center gap-3 text-lg font-bold transition-all ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200 dark:shadow-none ring-4 ring-red-50 dark:ring-red-900/10'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 dark:shadow-none'
            }`}
          >
            {isListening ? <><MicOff className="w-6 h-6" /> Stop</> : <><Mic className="w-6 h-6" /> Record</>}
          </button>

          <button
            onClick={handleAnalyze}
            disabled={isGenerating || transcripts.length === 0}
            className={`flex-1 rounded-2xl px-6 py-4 flex items-center justify-center gap-3 text-lg font-bold transition-all ${
              isGenerating || transcripts.length === 0
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white hover:opacity-90 shadow-lg'
            }`}
          >
            {isGenerating ? <><Loader2 className="w-6 h-6 animate-spin" /> Analyzing</> : <><Sparkles className="w-6 h-6" /> Analyze</>}
          </button>

          <button
            onClick={() => {
              if (confirm('Clear current session?')) {
                clearResponses()
                clearTranscripts()
                streamingIdRef.current = null
              }
            }}
            className="rounded-2xl px-5 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 group transition"
            aria-label="Clear all"
          >
            <Trash2 className="w-6 h-6 text-slate-400 group-hover:text-red-500 transition-colors" />
          </button>
        </div>
      </footer>

      <DeepgramTranscriber />
      <ErrorDisplay error={error} onDismiss={() => setError(null)} />
    </div>
  )
}