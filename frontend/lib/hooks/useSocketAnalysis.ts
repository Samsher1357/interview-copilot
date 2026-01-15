'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Socket } from 'socket.io-client'
import { Turn, InterviewContext } from '@/lib/types'
import { socketService } from '@/lib/socketService'

const ANALYSIS_TIMEOUT = 30000
const STREAM_BUFFER_MS = 100
const THINKING_DELAY_MS = 200  // Intentional delay before first token for natural UX

interface StreamCallbacks {
  onChunk: (chunk: string) => void
  onComplete: (fullResponse: string) => void
  onError: (error: string) => void
}

export function useSocketAnalysis() {
  const socketRef = useRef<Socket | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const bufferRef = useRef<string>('')
  const bufferTimerRef = useRef<NodeJS.Timeout | null>(null)
  const callbacksRef = useRef<StreamCallbacks | null>(null)
  const activeGenerationRef = useRef<number>(0)
  const thinkingDelayRef = useRef<NodeJS.Timeout | null>(null)
  const firstChunkReceivedRef = useRef<boolean>(false)

  useEffect(() => {
    let mounted = true
    socketService.getSocket().then(socket => {
      if (mounted) socketRef.current = socket
    }).catch(console.error)
    return () => {
      mounted = false
      clearAllTimers()
    }
  }, [])

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (bufferTimerRef.current) {
      clearTimeout(bufferTimerRef.current)
      bufferTimerRef.current = null
    }
    if (thinkingDelayRef.current) {
      clearTimeout(thinkingDelayRef.current)
      thinkingDelayRef.current = null
    }
  }, [])

  const flushBuffer = useCallback(() => {
    if (bufferRef.current && callbacksRef.current) {
      callbacksRef.current.onChunk(bufferRef.current)
      bufferRef.current = ''
    }
  }, [])

  const analyze = useCallback((
    turns: Turn[],
    utteranceText: string,
    language: string,
    interviewContext: InterviewContext,
    simpleEnglish: boolean,
    aiModel: string,
    generationId: number,  // For invalidation
    callbacks: StreamCallbacks
  ) => {
    const socket = socketRef.current
    if (!socket?.connected) {
      callbacks.onError('Socket not connected')
      return
    }

    // Set active generation
    activeGenerationRef.current = generationId
    callbacksRef.current = callbacks
    bufferRef.current = ''
    firstChunkReceivedRef.current = false
    let fullResponse = ''

    const cleanup = () => {
      clearAllTimers()
      socket.off('analyze:chunk')
      socket.off('analyze:complete')
      socket.off('analyze:error')
      socket.off('disconnect')
      callbacksRef.current = null
    }

    const resetTimeout = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        cleanup()
        callbacks.onError('Analysis timeout')
      }, ANALYSIS_TIMEOUT)
    }

    const handleDisconnect = (reason: string) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[SocketAnalysis] Socket disconnected during analysis: ${reason}`)
      }
      cleanup()
      callbacks.onError('Connection lost during analysis')
    }

    const handleChunk = (data: { chunk: string; generationId?: number }) => {
      // Check if this chunk belongs to current generation
      if (data.generationId !== undefined && data.generationId !== activeGenerationRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[SocketAnalysis] Ignoring stale chunk (gen ${data.generationId} vs ${activeGenerationRef.current})`)
        }
        return
      }

      fullResponse += data.chunk
      resetTimeout()

      // First chunk: apply thinking delay for natural UX
      if (!firstChunkReceivedRef.current) {
        firstChunkReceivedRef.current = true
        
        thinkingDelayRef.current = setTimeout(() => {
          bufferRef.current = fullResponse  // Include all buffered content
          flushBuffer()
        }, THINKING_DELAY_MS)
        return
      }

      // Subsequent chunks: buffer for smooth output
      bufferRef.current += data.chunk

      if (!bufferTimerRef.current) {
        bufferTimerRef.current = setTimeout(() => {
          flushBuffer()
          bufferTimerRef.current = null
        }, STREAM_BUFFER_MS)
      }

      // Immediate flush on sentence endings
      if (/[.!?\n]$/.test(data.chunk)) {
        if (bufferTimerRef.current) {
          clearTimeout(bufferTimerRef.current)
          bufferTimerRef.current = null
        }
        flushBuffer()
      }
    }

    const handleComplete = (data: { generationId?: number }) => {
      // Check generation
      if (data.generationId !== undefined && data.generationId !== activeGenerationRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[SocketAnalysis] Ignoring stale complete (gen ${data.generationId} vs ${activeGenerationRef.current})`)
        }
        return
      }

      // Clear thinking delay if still pending
      if (thinkingDelayRef.current) {
        clearTimeout(thinkingDelayRef.current)
        thinkingDelayRef.current = null
      }

      flushBuffer()
      cleanup()
      callbacks.onComplete(fullResponse)
    }

    const handleError = (data: { error: string; generationId?: number }) => {
      // Check generation
      if (data.generationId !== undefined && data.generationId !== activeGenerationRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[SocketAnalysis] Ignoring stale error (gen ${data.generationId} vs ${activeGenerationRef.current})`)
        }
        return
      }

      cleanup()
      callbacks.onError(data.error)
    }

    // Clear existing listeners
    socket.off('analyze:chunk')
    socket.off('analyze:complete')
    socket.off('analyze:error')
    socket.off('disconnect')

    resetTimeout()

    socket.on('analyze:chunk', handleChunk)
    socket.on('analyze:complete', handleComplete)
    socket.on('analyze:error', handleError)
    socket.on('disconnect', handleDisconnect)

    if (process.env.NODE_ENV === 'development') {
      console.log(`[SocketAnalysis] Starting analysis (gen ${generationId})`)
    }

    socket.emit('analyze:stream', {
      turns,
      utteranceText,
      language,
      interviewContext,
      simpleEnglish,
      aiModel,
      generationId,  // Send to backend for validation
    })
  }, [clearAllTimers, flushBuffer])

  const cancel = useCallback(() => {
    const socket = socketRef.current
    if (!socket) return

    if (process.env.NODE_ENV === 'development') {
      console.log(`[SocketAnalysis] Cancelling (gen ${activeGenerationRef.current})`)
    }

    // Invalidate current generation
    const cancelledGeneration = activeGenerationRef.current
    activeGenerationRef.current = -1

    flushBuffer()
    clearAllTimers()

    socket.off('analyze:chunk')
    socket.off('analyze:complete')
    socket.off('analyze:error')
    socket.off('disconnect')
    
    // Notify backend to stop streaming with the specific generation ID
    socket.emit('analyze:cancel', { generationId: cancelledGeneration })
    
    callbacksRef.current = null
    bufferRef.current = ''
    firstChunkReceivedRef.current = false
  }, [clearAllTimers, flushBuffer])

  return { analyze, cancel }
}
