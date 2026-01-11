'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Socket } from 'socket.io-client'
import { TranscriptEntry, AIResponse, InterviewContext } from '@/lib/store'
import { socketService } from '@/lib/socketService'

const ANALYSIS_TIMEOUT = 30000 // 30 seconds timeout for analysis

interface AnalysisOptions {
  transcripts: TranscriptEntry[]
  language: string
  interviewContext: InterviewContext
  simpleEnglish: boolean
  aiModel: string
  onChunk: (chunk: string) => void
  onComplete: (responses: AIResponse[]) => void
  onError: (error: string) => void
}

export function useSocketAnalysis() {
  const socketRef = useRef<Socket | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const activeRequestRef = useRef<boolean>(false)

  useEffect(() => {
    socketService.getSocket().then(socket => {
      socketRef.current = socket
    }).catch(error => {
      console.error('Failed to get socket:', error)
    })

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      activeRequestRef.current = false
    }
  }, [])

  const analyzeWithStreaming = useCallback((options: AnalysisOptions) => {
    const {
      transcripts,
      language,
      interviewContext,
      simpleEnglish,
      aiModel,
      onChunk,
      onComplete,
      onError
    } = options
    const socket = socketRef.current
    if (!socket) {
      onError('Socket not connected')
      return
    }

    if (!socket.connected) {
      onError('Socket is disconnected')
      return
    }

    if (activeRequestRef.current) return
    activeRequestRef.current = true

    const cleanup = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (socket?.connected) {
        socket.off('analyze:chunk')
        socket.off('analyze:complete')
        socket.off('analyze:error')
      }
      activeRequestRef.current = false
    }

    const handleChunk = (data: { chunk: string }) => {
      onChunk(data.chunk)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        onError('Analysis timeout')
        cleanup()
      }, ANALYSIS_TIMEOUT)
    }

    const handleComplete = (data: { result: any }) => {
      const responses: AIResponse[] = data.result.answer ? [{
        id: `answer-${Date.now()}`,
        type: 'answer',
        content: data.result.answer,
        timestamp: Date.now(),
        confidence: 0.9,
      }] : []
      
      onComplete(responses)
      cleanup()
    }

    const handleError = (data: { error: string }) => {
      onError(data.error)
      cleanup()
    }

    socket.off('analyze:chunk')
    socket.off('analyze:complete')
    socket.off('analyze:error')

    socket.on('analyze:chunk', handleChunk)
    socket.on('analyze:complete', handleComplete)
    socket.on('analyze:error', handleError)

    timeoutRef.current = setTimeout(() => handleError({ error: 'Analysis timeout' }), ANALYSIS_TIMEOUT)

    socket.emit('analyze:stream', {
      transcripts,
      language,
      interviewContext,
      simpleEnglish,
      aiModel,
    })
  }, [])

  const cancel = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    socketRef.current?.off('analyze:chunk')
    socketRef.current?.off('analyze:complete')
    socketRef.current?.off('analyze:error')
    activeRequestRef.current = false
  }, [])

  return { analyzeWithStreaming, cancel }
}
