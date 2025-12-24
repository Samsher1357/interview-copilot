'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Socket } from 'socket.io-client'
import { TranscriptEntry, AIResponse, InterviewContext } from '@/lib/store'
import { socketService } from '@/lib/socketService'

export function useSocketAnalysis() {
  const socketRef = useRef<Socket | null>(null)

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

    const handleChunk = (data: { chunk: string }) => {
      fullResponse += data.chunk
      onChunk(data.chunk)
    }

    const handleComplete = (data: { result: any }) => {
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
      onError(data.error)
      cleanup()
    }

    const cleanup = () => {
      socket.off('analyze:chunk', handleChunk)
      socket.off('analyze:complete', handleComplete)
      socket.off('analyze:error', handleError)
    }

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
    
    // Remove all listeners for this analysis
    socket.off('analyze:chunk')
    socket.off('analyze:complete')
    socket.off('analyze:error')
  }, [])

  return { analyzeWithStreaming, cancel }
}
