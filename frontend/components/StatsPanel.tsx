'use client'

import { useInterviewStore } from '@/lib/store'
import { useMemo } from 'react'
import { Clock, MessageSquare, Lightbulb, TrendingUp } from 'lucide-react'

export function StatsPanel() {
  const { transcripts, aiResponses } = useInterviewStore()

  const stats = useMemo(() => {
    const userCount = transcripts.filter(t => t.speaker === 'user').length
    const answerCount = aiResponses.filter(r => r.type === 'answer').length
    
    const totalWords = transcripts.reduce((sum, t) => sum + t.text.split(/\s+/).length, 0)
    
    const duration = transcripts.length > 0
      ? Math.round(((transcripts.at(-1)?.timestamp ?? 0) - transcripts[0].timestamp) / 1000 / 60)
      : 0

    return {
      duration,
      totalTranscripts: transcripts.length,
      userCount,
      answerCount,
      totalWords,
      avgWordsPerResponse: userCount > 0 ? Math.round(totalWords / userCount) : 0,
    }
  }, [transcripts, aiResponses])

  if (transcripts.length === 0) return null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        Interview Statistics
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
            <Clock className="w-3 h-3" />
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{stats.duration}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Minutes</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
            <MessageSquare className="w-3 h-3" />
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{stats.totalTranscripts}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Exchanges</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
            <Lightbulb className="w-3 h-3" />
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{stats.answerCount}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">AI Answers</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900 dark:text-white">{stats.totalWords}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Words</div>
        </div>
      </div>
    </div>
  )
}

