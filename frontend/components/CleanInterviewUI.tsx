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

import { useCopilotStore } from '@/lib/store'
import { CopilotEngine } from './CopilotEngine'
import { FormattedContent } from './FormattedContent'
import { ErrorDisplay } from './ErrorDisplay'
import { SetupScreen } from './SetupScreen'

const STATE_LABELS: Record<string, string> = {
  IDLE: 'Ready',
  LISTENING: 'Listening',
  USER_SPEAKING: 'Speaking',
  AI_THINKING: 'Thinking',
  AI_RESPONDING: 'Responding',
  INTERRUPTED: 'Interrupted',
}

export function CleanInterviewUI() {
  const {
    conversationState,
    turns,
    streamingResponse,
    error,
    interviewContext,
    isInterviewStarted,
    setInterviewStarted,
    clearSession,
    reset,
    setError,
  } = useCopilotStore()

  const hasCompletedSetup = !!(
    interviewContext.jobRole ||
    interviewContext.company ||
    interviewContext.skills?.length
  )

  const [showSetup, setShowSetup] = useState(!hasCompletedSetup)
  const [showHistory, setShowHistory] = useState(false)
  const historyRef = useRef<HTMLDivElement>(null)

  // Get latest AI response
  const latestAITurn = useMemo(() => {
    const aiTurns = turns.filter(t => t.speaker === 'ai')
    return aiTurns[aiTurns.length - 1]
  }, [turns])

  // Display content: streaming or latest turn
  const displayContent = streamingResponse || latestAITurn?.content || null
  const isGenerating = conversationState === 'AI_THINKING' || conversationState === 'AI_RESPONDING'
  const isListening = conversationState === 'LISTENING' || conversationState === 'USER_SPEAKING'

  // Auto-scroll history
  useEffect(() => {
    if (showHistory && historyRef.current) {
      historyRef.current.scrollTo({ top: historyRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [turns, showHistory])

  const handleEnd = () => {
    if (!confirm('End session and clear everything?')) return
    reset()
    setShowSetup(true)
  }

  const handleClear = () => {
    if (!confirm('Clear current session?')) return
    clearSession()
  }

  if (showSetup) {
    return (
      <SetupScreen
        onStart={() => {
          setShowSetup(false)
          setInterviewStarted(true)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      {/* Header */}
      <header className="flex-none bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 z-30">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg font-bold truncate">AI Interview Copilot</h1>
              <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                {interviewContext.jobRole || 'Real-time assistance'}
              </p>
            </div>
            
            {/* State indicator */}
            <div className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full flex-shrink-0 ${
              isListening
                ? 'bg-green-100 dark:bg-green-900/30'
                : isGenerating
                ? 'bg-amber-100 dark:bg-amber-900/30'
                : 'bg-slate-100 dark:bg-slate-800'
            }`}>
              <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                isListening
                  ? 'bg-green-500 animate-pulse'
                  : isGenerating
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-slate-400'
              }`} />
              <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest ${
                isListening
                  ? 'text-green-700 dark:text-green-400'
                  : isGenerating
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-slate-500'
              }`}>
                {STATE_LABELS[conversationState] || conversationState}
              </span>
            </div>
          </div>

          <div className="flex gap-1 sm:gap-2 flex-shrink-0">
            <button
              onClick={() => setShowSetup(true)}
              className="p-1.5 sm:p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
            </button>
            <button
              onClick={handleEnd}
              className="p-1.5 sm:p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition text-red-500"
              aria-label="End session"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 scroll-smooth relative z-10">
        <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4 pb-40 sm:pb-44">
          
          {/* Conversation History (Collapsible) */}
          <section className="bg-white dark:bg-slate-900 rounded-lg sm:rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 flex justify-between items-center text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <span className="flex items-center gap-2">
                <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 flex-shrink-0" />
                <span>Conversation</span>
                {turns.length > 0 && (
                  <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                    {turns.length} turns
                  </span>
                )}
              </span>
              {showHistory ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            {showHistory && (
              <div
                ref={historyRef}
                className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2 max-h-40 sm:max-h-48 overflow-y-auto border-t border-slate-100 dark:border-slate-800"
              >
                {turns.length > 0 ? (
                  <div className="space-y-2">
                    {turns.map((turn, i) => (
                      <div
                        key={i}
                        className={`text-xs sm:text-sm p-2 rounded ${
                          turn.speaker === 'user'
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="font-semibold">{turn.speaker === 'user' ? 'You' : 'AI'}:</span>{' '}
                        {turn.content.slice(0, 200)}{turn.content.length > 200 ? '...' : ''}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 dark:text-slate-500 italic text-sm">No conversation yet...</p>
                )}
              </div>
            )}
          </section>

          {/* AI Answer Section */}
          <section className="bg-white dark:bg-slate-900 rounded-lg sm:rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 min-h-[350px] sm:min-h-[450px] relative">
            <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 backdrop-blur-sm px-3 sm:px-4 py-2.5 sm:py-3 flex justify-between items-center border-b border-slate-200 dark:border-slate-700 rounded-t-lg sm:rounded-t-xl z-10">
              <h2 className="text-sm sm:text-base font-bold flex items-center gap-1.5 sm:gap-2 text-slate-800 dark:text-slate-100">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 flex-shrink-0" />
                <span>AI Answer</span>
              </h2>
              {displayContent && !isGenerating && (
                <button
                  onClick={() => navigator.clipboard.writeText(displayContent)}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium bg-white dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-slate-600 rounded-md sm:rounded-lg transition shadow-sm border border-slate-200 dark:border-slate-600"
                  aria-label="Copy answer"
                >
                  <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="hidden xs:inline">Copy</span>
                </button>
              )}
            </div>

            <div className="p-4 sm:p-6">
              {displayContent ? (
                <div className="prose dark:prose-invert max-w-none prose-sm sm:prose-base">
                  <FormattedContent content={displayContent} isStreaming={isGenerating} />
                  {isGenerating && (
                    <span className="inline-block w-1 sm:w-1.5 h-4 sm:h-5 ml-1 sm:ml-2 bg-blue-500 animate-pulse align-middle rounded-sm" />
                  )}
                </div>
              ) : isGenerating ? (
                <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-slate-500">
                  <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin mb-3 sm:mb-4 text-blue-500" />
                  <p className="text-base sm:text-lg font-medium text-slate-700 dark:text-slate-300">
                    {conversationState === 'AI_THINKING' ? 'Thinking...' : 'Generating response...'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 sm:py-20">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 rounded-full flex items-center justify-center mb-3 sm:mb-4 shadow-inner">
                    <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400 dark:text-slate-500" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-center text-sm sm:text-lg px-4">
                    Speak naturally. AI will respond when you finish your thought.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Bottom Bar */}
      <footer className="flex-none bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t-2 border-slate-300 dark:border-slate-700 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_-8px_30px_rgb(0,0,0,0.5)] z-40">
        <div className="max-w-4xl mx-auto flex gap-2 sm:gap-3">
          {/* Mic indicator */}
          <div className={`flex-1 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-center gap-2 sm:gap-3 text-base sm:text-lg font-bold ${
            isListening
              ? 'bg-green-500 text-white shadow-lg shadow-green-200 dark:shadow-none ring-2 sm:ring-4 ring-green-50 dark:ring-green-900/10'
              : isGenerating
              ? 'bg-amber-500 text-white shadow-lg shadow-amber-200 dark:shadow-none'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}>
            {isListening ? (
              <>
                <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="hidden xs:inline">Listening</span>
              </>
            ) : isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                <span className="hidden xs:inline">Processing</span>
              </>
            ) : (
              <>
                <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="hidden xs:inline">Paused</span>
              </>
            )}
          </div>

          <button
            onClick={handleClear}
            className="rounded-xl sm:rounded-2xl px-3 sm:px-5 py-3 sm:py-4 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 group transition flex items-center justify-center"
            aria-label="Clear all"
          >
            <Trash2 className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 group-hover:text-red-500 transition-colors" />
          </button>
        </div>
      </footer>

      <CopilotEngine />
      <ErrorDisplay error={error} onDismiss={() => setError(null)} />
    </div>
  )
}
