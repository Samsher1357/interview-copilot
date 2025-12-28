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
  ChevronUp,
  ChevronDown,
  Smartphone
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

  /* -------------------- UI STATE -------------------- */
  const [compactMode, setCompactMode] = useState(true)
  const [showTranscript, setShowTranscript] = useState(false)
  const [isManualAnalyzing, setIsManualAnalyzing] = useState(false)

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

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: 'smooth'
    })
  }, [fullTranscript])

  /* -------------------- ACTIONS -------------------- */
  const handleAnalyze = async () => {
    if (!transcripts.length || isAnalyzing || isManualAnalyzing) return

    setIsManualAnalyzing(true)
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
        setIsManualAnalyzing(false)
      },
      err => {
        setError(err)
        setIsManualAnalyzing(false)
      }
    )
  }

  const handleEnd = () => {
    if (!confirm('End session and clear everything?')) return
    cancel()
    setIsListening(false)
    clearResponses()
    clearTranscripts()
    setShowSetup(true)
  }

  /* -------------------- SETUP SCREEN -------------------- */
  if (showSetup) {
    return <SetupScreen onStart={() => setShowSetup(false)} />
  }

  /* =====================================================
     UI
  ===================================================== */

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-2 flex justify-between items-center">
          <div>
            <h1 className="text-sm font-bold">AI Interview Copilot</h1>
            <p className="text-xs text-slate-500">Real-time assistance</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setCompactMode(!compactMode)}
              className="icon-btn"
              title="Toggle compact mode"
            >
              <Smartphone className="w-4 h-4" />
            </button>

            <button onClick={() => setShowSetup(true)} className="icon-btn">
              <Settings className="w-4 h-4" />
            </button>

            <button onClick={handleEnd} className="icon-btn text-red-500">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ================= MAIN ================= */}
      <main className="max-w-6xl mx-auto px-4 py-3 space-y-3">
        {/* -------- TRANSCRIPT (COLLAPSIBLE) -------- */}
        <div className="card">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex justify-between w-full px-3 py-2 text-xs font-semibold"
          >
            <span>Transcript</span>
            {showTranscript ? <ChevronUp /> : <ChevronDown />}
          </button>

          {showTranscript && (
            <div
              ref={transcriptRef}
              className="px-3 pb-3 text-xs max-h-32 overflow-y-auto"
            >
              {fullTranscript || (
                <p className="text-slate-400">Start speaking…</p>
              )}
            </div>
          )}
        </div>

        {/* -------- ANSWER -------- */}
        <div className="card flex flex-col h-[calc(100vh-280px)]">
          <div className="flex justify-between items-center px-4 py-2 border-b">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> AI Answer
            </h2>
            {latestAnswer && (
              <button
                onClick={() =>
                  navigator.clipboard.writeText(latestAnswer.content)
                }
                className="icon-btn"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto text-sm">
            {latestAnswer ? (
              <FormattedContent content={latestAnswer.content} />
            ) : (
              <p className="text-slate-400 text-center mt-20">
                Tap Analyze to get an answer
              </p>
            )}
          </div>
        </div>
      </main>

      {/* ================= BOTTOM BAR (MOBILE FIRST) ================= */}
      <footer className="fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-slate-900 border-t px-4 py-3 flex gap-3">
        <button
          onClick={() => setIsListening(!isListening)}
          className={`flex-1 btn-primary ${
            isListening ? 'bg-red-600' : ''
          }`}
        >
          {isListening ? (
            <>
              <MicOff className="w-4 h-4" /> Stop
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" /> Record
            </>
          )}
        </button>

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || isManualAnalyzing}
          className="flex-1 btn-secondary"
        >
          <Sparkles className="w-4 h-4" />
          Analyze
        </button>

        <button
          onClick={() => {
            clearResponses()
            clearTranscripts()
          }}
          className="icon-btn text-red-500"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </footer>

      <DeepgramTranscriber />
      <ErrorDisplay error={error} onDismiss={() => setError(null)} />
    </div>
  )
}