'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Socket } from 'socket.io-client'
import { TranscriptEntry, AIResponse, InterviewContext } from '@/lib/store'
import { socketService } from '@/lib/socketService'

const ANALYSIS_TIMEOUT = 30000 // 30 seconds timeout for analysis
const MAX_RETRY_ATTEMPTS = 2

export function useSocketAnalysis() {
  const socketRef = useRef<Socket | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef(0)

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

    let fullResponse = ''
    let hasReceivedData = false

    const handleChunk = (data: { chunk: string }) => {
      hasReceivedData = true
      fullResponse += data.chunk
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
      
      retryCountRef.current = 0 // Reset retry count on success
      
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

      if (result.suggestions?.length > 0) {
        responses.push({
          id: `suggestion-${baseTimestamp + 1}`,
          type: 'suggestion',
          content: result.suggestions[0],
          timestamp: baseTimestamp + 1,
          confidence: 0.8,
        })
      }

      if (result.hints?.length > 0) {
        responses.push({
          id: `hint-${baseTimestamp + 2}`,
          type: 'hint',
          content: result.hints[0],
          timestamp: baseTimestamp + 2,
          confidence: 0.7,
        })
      }

      if (result.talkingPoints?.length > 0) {
        responses.push({
          id: `talking-point-${baseTimestamp + 3}`,
          type: 'talking-point',
          content: result.talkingPoints[0],
          timestamp: baseTimestamp + 3,
          confidence: 0.75,
        })
      }

      onComplete(responses)
      cleanup()
    }

    const handleError = (data: { error: string }) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      // Retry logic for transient failures
      if (retryCountRef.current < MAX_RETRY_ATTEMPTS && !hasReceivedData) {
        retryCountRef.current++
        console.log(`Retrying analysis (attempt ${retryCountRef.current}/${MAX_RETRY_ATTEMPTS})`)
        
        cleanup()
        
        // Retry after a short delay
        setTimeout(() => {
          analyzeWithStreaming(
            transcripts,
            language,
            interviewContext,
            simpleEnglish,
            aiModel,
            onChunk,
            onComplete,
            onError
          )
        }, 1000 * retryCountRef.current)
        
        return
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
    
    // Reset retry count
    retryCountRef.current = 0
    
    // Remove all listeners for this analysis
    socket.off('analyze:chunk')
    socket.off('analyze:complete')
    socket.off('analyze:error')
  }, [])

  return { analyzeWithStreaming, cancel }
}
