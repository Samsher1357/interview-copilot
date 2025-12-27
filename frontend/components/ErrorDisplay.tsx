'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, X } from 'lucide-react'

interface ErrorDisplayProps {
  error: string | null
  onDismiss: () => void
}

export function ErrorDisplay({ error, onDismiss }: Readonly<ErrorDisplayProps>) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (error) {
      setIsVisible(true)
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(onDismiss, 300) // Wait for animation
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, onDismiss])

  if (!error || !isVisible) return null

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-down">
      <div className="bg-white dark:bg-slate-800 border-2 border-red-400 dark:border-red-600 rounded-xl p-4 shadow-soft max-w-md">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-red-800 dark:text-red-200 mb-1">
              Error
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {error}
            </p>
          </div>
          <button
            onClick={() => {
              setIsVisible(false)
              setTimeout(onDismiss, 300)
            }}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

