'use client'

import { useInterviewStore } from '@/lib/store'
import { User } from 'lucide-react'
import { useEffect, useRef, useCallback, useMemo } from 'react'

export function TranscriptPanel() {
  const { transcripts } = useInterviewStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  
  // Memoize displayed transcripts (keep last 100 for performance)
  const displayedTranscripts = useMemo(() => {
    return transcripts.slice(-100)
  }, [transcripts])

  // Auto-scroll to bottom when new transcripts are added (optimized with RAF)
  useEffect(() => {
    let rafId: number
    const timeoutId = setTimeout(() => {
      rafId = requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      })
    }, 50)
    return () => {
      clearTimeout(timeoutId)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [displayedTranscripts])

  const formatTime = useCallback((timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }, [])


  if (transcripts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p>No transcripts yet. Click "Start Listening" to begin.</p>
      </div>
    )
  }

  return (
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto space-y-2 sm:space-y-3 pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
        >
          {transcripts.map((entry) => (
            <div
              key={entry.id}
              className={`flex gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl ${
                entry.speaker === 'user'
                  ? 'bg-blue-50/80 dark:bg-blue-900/20 border-l-3 border-blue-400'
                  : 'bg-gray-50 dark:bg-gray-700/50'
              }`}
            >
          <div className="flex-shrink-0 mt-0.5 sm:mt-1">
            <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                {entry.speaker === 'user' ? 'Candidate' : 'System'}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatTime(entry.timestamp)}
              </span>
            </div>
            <p className="text-gray-900 dark:text-gray-100 text-xs sm:text-sm leading-relaxed">
              {entry.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

