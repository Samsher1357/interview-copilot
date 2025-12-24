'use client'

import { memo, useMemo } from 'react'
import { useInterviewStore } from '@/lib/store'
import { MessageSquare, Lightbulb, Target, Sparkles } from 'lucide-react'
import { FormattedContent } from './FormattedContent'

// OPTIMIZED: Memoized individual response item
const ResponseItem = memo(function ResponseItem({ response }: { response: any }) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'answer':
        return <MessageSquare className="w-4 h-4" />
      case 'suggestion':
        return <Lightbulb className="w-4 h-4" />
      case 'hint':
        return <Sparkles className="w-4 h-4" />
      case 'talking-point':
        return <Target className="w-4 h-4" />
      default:
        return <MessageSquare className="w-4 h-4" />
    }
  }

  const getStyles = (type: string) => {
    switch (type) {
      case 'answer':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          icon: 'text-blue-600 dark:text-blue-400',
          title: 'Answer',
        }
      case 'suggestion':
        return {
          bg: 'bg-purple-50 dark:bg-purple-900/20',
          border: 'border-purple-200 dark:border-purple-800',
          icon: 'text-purple-600 dark:text-purple-400',
          title: 'Suggestion',
        }
      case 'hint':
        return {
          bg: 'bg-amber-50 dark:bg-amber-900/20',
          border: 'border-amber-200 dark:border-amber-800',
          icon: 'text-amber-600 dark:text-amber-400',
          title: 'Hint',
        }
      case 'talking-point':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-900/20',
          border: 'border-emerald-200 dark:border-emerald-800',
          icon: 'text-emerald-600 dark:text-emerald-400',
          title: 'Talking Point',
        }
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-800/20',
          border: 'border-gray-200 dark:border-gray-700',
          icon: 'text-gray-600 dark:text-gray-400',
          title: 'Info',
        }
    }
  }

  const styles = getStyles(response.type)

  return (
    <div
      className={`${styles.bg} ${styles.border} border rounded-xl p-4 transition-all hover:shadow-md`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={styles.icon}>{getIcon(response.type)}</div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {styles.title}
        </h3>
      </div>
      <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <FormattedContent content={response.content} />
      </div>
    </div>
  )
})

// OPTIMIZED: Show ONLY the most recent answer
export const OptimizedResponsePanel = memo(function OptimizedResponsePanel() {
  const aiResponses = useInterviewStore((state) => state.aiResponses)

  // SHOW ONLY THE MOST RECENT ANSWER
  const latestAnswer = useMemo(() => {
    // Filter to only "answer" type and get the most recent
    const answers = aiResponses.filter(r => r.type === 'answer')
    return answers.length > 0 ? [answers.at(-1)] : []
  }, [aiResponses])

  const recentResponses = latestAnswer

  if (recentResponses.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-center p-8">
        <div className="space-y-3">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-gray-900 dark:text-white font-medium mb-1">
              Ready to assist
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              AI will provide help as you speak
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-3 pb-4">
        {recentResponses.map((response) => (
          response && <ResponseItem key={response.id} response={response} />
        ))}
      </div>
    </div>
  )
})

