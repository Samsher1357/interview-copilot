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

  const latestAnswer = useMemo(
    () =>
      aiResponses.length
        ? [...aiResponses].sort((a, b) => b.timestamp - a.timestamp)[0]
        : null,
    [aiResponses]
  )

  const isGenerating = isAnalyzing || !!streamingIdRef.current

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: 'smooth'
    })
  }, [fullTranscript])

  /* -------------------- ACTIONS -------------------- */
  const handleAnalyze = async () => {
    if (!transcripts.length || isAnalyzing || streamingIdRef.current) return

    setError(null)
    cancel()

    streamingRef.current = ''
    streamingIdRef.current = null

    analyzeWithStreaming(
      transcripts.slice(-8),
      currentLanguage.split('-')[0],
      interviewContext,
      simpleEnglish,
      aiModel,
      chunk => {
        streamingRef.current += chunk

        if (!streamingIdRef.current) {
          streamingIdRef.current = `stream-${Date.now()}`
          addAIResponse({
            id: streamingIdRef.current,
            type: 'answer',
            content: streamingRef.current,
            timestamp: Date.now(),
            confidence: 0.9
          })
        } else {
          useInterviewStore
            .getState()
            .updateAIResponse(streamingIdRef.current, {
              content: streamingRef.current
            })
        }
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

  /* -------------------- SETUP SCREEN -------------------- */
  if (showSetup) {
    return <SetupScreen onStart={() => setShowSetup(false)} />
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950">
      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold">AI Interview Copilot</h1>
            <p className="text-sm text-slate-500">Real-time assistance</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowSetup(true)} className="icon-btn" aria-label="Settings">
              <Settings className="w-5 h-5" />
            </button>
            <button onClick={handleEnd} className="icon-btn text-red-500" aria-label="End session">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 flex flex-col gap-4 px-4 py-4 max-w-6xl mx-auto w-full overflow-hidden">
        {/* -------- TRANSCRIPT (COLLAPSIBLE) -------- */}
        <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full px-4 py-3 flex justify-between items-center text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-t-xl transition"
            aria-label="Toggle transcript"
          >
            <span>Transcript</span>
            {showTranscript ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {showTranscript && (
            <div
              ref={transcriptRef}
              className="px-4 pb-4 pt-2 text-sm text-slate-700 dark:text-slate-300 max-h-64 overflow-y-auto"
            >
              {fullTranscript || (
                <p className="text-slate-400 italic">Start speaking to see the transcript…</p>
              )}
            </div>
          )}
        </section>

        {/* -------- AI ANSWER (EXPANDS PROPERLY) -------- */}
        <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex-1 flex flex-col min-h-0">
          <div className="px-4 py-3 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              AI Answer
            </h2>
            {latestAnswer && !isGenerating && (
              <button
                onClick={() => navigator.clipboard.writeText(latestAnswer.content)}
                className="icon-btn hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Copy answer"
              >
                <Copy className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto text-base leading-relaxed">
            {latestAnswer ? (
              <FormattedContent content={latestAnswer.content} />
            ) : isGenerating ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p className="text-lg">Generating response...</p>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-slate-400 text-center text-lg">
                  Tap <span className="font-semibold">Analyze</span> to get an answer
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ================= BOTTOM BAR (SAFE AREA) ================= */}
      <footer className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="px-4 py-4 flex gap-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          <button
            onClick={() => setIsListening(!isListening)}
            className={`flex-1 rounded-xl px-6 py-4 flex items-center justify-center gap-3 text-lg font-semibold transition-all shadow-lg ${
              isListening
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
            aria-label={isListening ? 'Stop recording' : 'Start recording'}
          >
            {isListening ? (
              <>
                <MicOff className="w-6 h-6" />
                Stop
              </>
            ) : (
              <>
                <Mic className="w-6 h-6" />
                Record
              </>
            )}
          </button>

          <button
            onClick={handleAnalyze}
            disabled={isGenerating || transcripts.length === 0}
            className="flex-1 rounded-xl px-6 py-4 flex items-center justify-center gap-3 text-lg font-semibold bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
            aria-label="Analyze transcript"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-6 h-6" />
                Analyze
              </>
            )}
          </button>

          <button
            onClick={() => {
              clearResponses()
              clearTranscripts()
              streamingIdRef.current = null
            }}
            className="rounded-xl p-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition shadow-lg"
            aria-label="Clear all"
          >
            <Trash2 className="w-6 h-6 text-red-500" />
          </button>
        </div>
      </footer>

      <DeepgramTranscriber />
      <ErrorDisplay error={error} onDismiss={() => setError(null)} />
    </div>
  )
}