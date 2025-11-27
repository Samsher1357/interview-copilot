'use client'

import { useInterviewStore, AIResponse } from '@/lib/store'
import { Lightbulb, HelpCircle, MessageSquare, CheckCircle, Volume2 } from 'lucide-react'
import { useEffect, useRef, useMemo, useCallback } from 'react'
import { FormattedContent } from './FormattedContent'
import { AnalyzingIndicator } from './LoadingSkeleton'

export function ResponsePanel() {
  const { aiResponses, currentLanguage, isAnalyzing } = useInterviewStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Memoize latest responses for better performance
  const latestResponses = useMemo(() => {
    return aiResponses.slice(-20) // Keep last 20 responses
  }, [aiResponses])

  useEffect(() => {
    // Auto-scroll to bottom when new responses are added (optimized with RAF)
    let rafId: number
    const timeoutId = setTimeout(() => {
      rafId = requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      })
    }, 30)
    return () => {
      clearTimeout(timeoutId)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [latestResponses])

  // Memoize helper functions
  const getIcon = useCallback((type: AIResponse['type']) => {
    switch (type) {
      case 'answer':
        return <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
      case 'suggestion':
        return <CheckCircle className="w-5 h-5 text-primary-500" />
      case 'hint':
        return <Lightbulb className="w-5 h-5 text-yellow-500" />
      case 'talking-point':
        return <MessageSquare className="w-5 h-5 text-green-500" />
      default:
        return <MessageSquare className="w-5 h-5 text-gray-500" />
    }
  }, [])

  const getTypeLabel = useCallback((type: AIResponse['type']) => {
    switch (type) {
      case 'answer':
        return 'Complete Answer'
      case 'suggestion':
        return 'Suggestion'
      case 'hint':
        return 'Hint'
      case 'talking-point':
        return 'Talking Point'
      default:
        return 'Response'
    }
  }, [])

  const getTypeColor = useCallback((type: AIResponse['type']) => {
    switch (type) {
      case 'answer':
        return 'border-blue-600 dark:border-blue-400 bg-blue-100 dark:bg-blue-900/30 shadow-md'
      case 'suggestion':
        return 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
      case 'hint':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
      case 'talking-point':
        return 'border-green-500 bg-green-50 dark:bg-green-900/20'
      default:
        return 'border-gray-500 bg-gray-50 dark:bg-gray-700/50'
    }
  }, [])

  const speakResponse = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = currentLanguage
      utterance.rate = 0.9
      utterance.pitch = 1.0
      speechSynthesis.speak(utterance)
    }
  }, [currentLanguage])

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // Memoize sorted responses for performance - MUST be before any early returns
  const { latestAnswer, otherResponses } = useMemo(() => {
    if (aiResponses.length === 0) {
      return { latestAnswer: undefined, otherResponses: [] }
    }
    const sorted = [...aiResponses].sort((a, b) => {
      if (a.type === 'answer' && b.type !== 'answer') return -1
      if (a.type !== 'answer' && b.type === 'answer') return 1
      return b.timestamp - a.timestamp
    })
    const latest = sorted.find(r => r.type === 'answer')
    const others = sorted.filter(r => r.id !== latest?.id)
    return { latestAnswer: latest, otherResponses: others }
  }, [aiResponses])

  if (aiResponses.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        {isAnalyzing ? (
          <AnalyzingIndicator />
        ) : (
          <div className="text-center py-8 sm:py-12 text-gray-500 dark:text-gray-400 space-y-2">
            <p className="text-sm sm:text-base font-medium">
              AI answers will appear here
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              When the interviewer asks questions
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Latest Answer - Prominent Display - Scrollable */}
      {latestAnswer && (
        <div className="mb-3 flex-shrink-0">
          <div
            className={`border-l-4 rounded-2xl p-5 sm:p-6 transition-all shadow-xl ${getTypeColor(
              latestAnswer.type
            )} max-h-[65vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent`}
          >
            <div className="flex items-center gap-2 mb-4">
              {getIcon(latestAnswer.type)}
              <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                {getTypeLabel(latestAnswer.type)}
              </span>
            </div>
            <div className="text-base sm:text-lg text-gray-900 dark:text-gray-100 leading-relaxed">
              <FormattedContent content={latestAnswer.content} />
            </div>
          </div>
        </div>
      )}

      {/* Other Responses - Scrollable */}
      {otherResponses.length > 0 && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent pr-1"
          >
            {otherResponses.map((response) => (
              <div
                key={response.id}
                className={`border-l-3 rounded-xl p-3 sm:p-4 transition-all ${getTypeColor(
                  response.type
                )}`}
              >
                <div className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
                  <FormattedContent content={response.content} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

