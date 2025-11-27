'use client'

import { useEffect } from 'react'
import { useInterviewStore } from '@/lib/store'
import { Mic, MicOff, Trash2, Download, FileText } from 'lucide-react'

export function ControlPanel() {
  const {
    isListening,
    isAnalyzing,
    transcripts,
    aiResponses,
    setIsListening,
    clearTranscripts,
    clearResponses,
    exportData,
  } = useInterviewStore()

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only if not typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      // Space: Toggle listening
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        setIsListening(!isListening)
      }

      // Ctrl+E: Export as JSON
      if ((e.ctrlKey || e.metaKey) && e.key === 'e' && !e.shiftKey) {
        if (transcripts.length > 0 || aiResponses.length > 0) {
          e.preventDefault()
          handleExportJSON()
        }
      }

      // Ctrl+Shift+E: Export as Text
      if ((e.ctrlKey || e.metaKey) && e.key === 'E' && e.shiftKey) {
        if (transcripts.length > 0 || aiResponses.length > 0) {
          e.preventDefault()
          handleExportText()
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isListening, setIsListening, transcripts.length, aiResponses.length])

  const handleToggleListening = () => {
    setIsListening(!isListening)
  }

  const handleClear = () => {
    if (confirm('Clear all transcripts and responses?')) {
      clearTranscripts()
      clearResponses()
    }
  }

  const handleExportJSON = () => {
    try {
      const data = exportData()
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `interview-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export data')
    }
  }

  const handleExportText = () => {
    try {
      let text = '=== Interview Transcript ===\n\n'
      text += `Date: ${new Date().toLocaleString()}\n\n`
      
      text += '--- Conversation ---\n\n'
      transcripts.forEach((t) => {
        const time = new Date(t.timestamp).toLocaleTimeString()
        const speaker = t.speaker === 'interviewer' ? 'Interviewer' : 'You'
        text += `[${time}] ${speaker}: ${t.text}\n\n`
      })
      
      text += '\n--- AI Responses ---\n\n'
      aiResponses.forEach((r) => {
        const time = new Date(r.timestamp).toLocaleTimeString()
        const type = r.type.charAt(0).toUpperCase() + r.type.slice(1)
        text += `[${time}] ${type}:\n${r.content}\n\n`
      })
      
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `interview-${new Date().toISOString().slice(0, 10)}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export data')
    }
  }

  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={handleToggleListening}
          className={`flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-white transition-all transform active:scale-95 shadow-lg ${
            isListening
              ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 animate-pulse'
              : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
          }`}
        >
          {isListening ? (
            <>
              <MicOff className="w-5 h-5" />
              <span className="hidden sm:inline">Stop</span>
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              <span className="hidden sm:inline">Start</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          {isListening && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-red-700 dark:text-red-400">Live</span>
            </div>
          )}
          {isAnalyzing && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="w-2 h-2 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-medium text-blue-700 dark:text-blue-400">AI Thinking</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {(transcripts.length > 0 || aiResponses.length > 0) && (
            <>
              <button
                onClick={handleExportJSON}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                title="Export as JSON"
                aria-label="Export as JSON"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleExportText}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all"
                title="Export as Text"
                aria-label="Export as Text"
              >
                <FileText className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={handleClear}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
            title="Clear all"
            aria-label="Clear all transcripts and responses"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

