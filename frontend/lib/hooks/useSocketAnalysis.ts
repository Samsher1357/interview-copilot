'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Socket } from 'socket.io-client'
import { TranscriptEntry, AIResponse, InterviewContext } from '@/lib/store'
import { socketService } from '@/lib/socketService'

const ANALYSIS_TIMEOUT = 30000 // 30 seconds timeout for analysis

export function useSocketAnalysis() {
  const socketRef = useRef<Socket | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    socketRef.current = socketService.getSocket()
  }, [])

  const analyzeWithStreaming = useCallback((
    transcripts: TranscriptEntry[],
    language: string,
    interviewContext: InterviewContext,
    simpleEnglish: boolean,
    aiModel: string,
    onChunk: (chunk: string) => void,
    onComplete: (responses: AIResponse[]) => void,
    onError: (error: string) => void
  ) => {
    const socket = socketRef.current
    if (!socket) {
      onError('Socket not connected')
      return
    }

    const handleChunk = (data: { chunk: string }) => {
      onChunk(data.chunk)
      
      // Reset timeout on each chunk
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        handleError({ error: 'Analysis timeout - no response from server' })
      }, ANALYSIS_TIMEOUT)
    }

    const handleComplete = (data: { result: any }) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      const result = data.result
      const responses: AIResponse[] = []
      const baseTimestamp = Date.now()

      if (result.answer) {
        responses.push({
          id: `answer-${baseTimestamp}`,
          type: 'answer',
          content: result.answer,
          timestamp: baseTimestamp,
          confidence: 0.9,
        })
      }

      onComplete(responses)
      cleanup()
    }

    const handleError = (data: { error: string }) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      onError(data.error)
      cleanup()
    }

    const cleanup = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      socket.off('analyze:chunk', handleChunk)
      socket.off('analyze:complete', handleComplete)
      socket.off('analyze:error', handleError)
    }

    // Set initial timeout
    timeoutRef.current = setTimeout(() => {
      handleError({ error: 'Analysis timeout - no response from server' })
    }, ANALYSIS_TIMEOUT)

    socket.on('analyze:chunk', handleChunk)
    socket.on('analyze:complete', handleComplete)
    socket.on('analyze:error', handleError)

    socket.emit('analyze:stream', {
      transcripts,
      language,
      interviewContext,
      simpleEnglish,
      aiModel,
    })
  }, [])

  const cancel = useCallback(() => {
    const socket = socketRef.current
    if (!socket) return
    
    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    // Remove all listeners for this analysis
    socket.off('analyze:chunk')
    socket.off('analyze:complete')
    socket.off('analyze:error')
  }, [])

  return { analyzeWithStreaming, cancel }
}
