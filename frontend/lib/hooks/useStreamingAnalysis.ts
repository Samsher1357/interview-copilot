'use client'

import { useCallback, useRef } from 'react'
import { TranscriptEntry, AIResponse, InterviewContext } from '@/lib/store'

export function useStreamingAnalysis() {
  const abortControllerRef = useRef<AbortController | null>(null)

  const analyzeWithStreaming = useCallback(async (
    transcripts: TranscriptEntry[],
    language: string,
    interviewContext: InterviewContext,
    simpleEnglish: boolean,
    aiModel: string,
    onChunk: (chunk: string) => void,
    onComplete: (responses: AIResponse[]) => void,
    onError: (error: string) => void
  ) => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/api/analyze-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcripts,
          language,
          interviewContext,
          simpleEnglish,
          aiModel,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let buffer = ''
      let fullResponse = ''

      while (true) {
        // Check if request was aborted
        if (abortControllerRef.current?.signal.aborted) {
          break
        }
        
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.chunk) {
                // Double-check abort status before processing chunk
                if (abortControllerRef.current?.signal.aborted) {
                  return
                }
                fullResponse += data.chunk
                onChunk(data.chunk)
              }

              if (data.done && data.result) {
                // Parse the result and convert to AIResponse[]
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

                if (result.suggestions && result.suggestions.length > 0) {
                  responses.push({
                    id: `suggestion-${baseTimestamp + 1}`,
                    type: 'suggestion',
                    content: result.suggestions[0],
                    timestamp: baseTimestamp + 1,
                    confidence: 0.8,
                  })
                }

                if (result.hints && result.hints.length > 0) {
                  responses.push({
                    id: `hint-${baseTimestamp + 2}`,
                    type: 'hint',
                    content: result.hints[0],
                    timestamp: baseTimestamp + 2,
                    confidence: 0.7,
                  })
                }

                if (result.talkingPoints && result.talkingPoints.length > 0) {
                  responses.push({
                    id: `talking-point-${baseTimestamp + 3}`,
                    type: 'talking-point',
                    content: result.talkingPoints[0],
                    timestamp: baseTimestamp + 3,
                    confidence: 0.75,
                  })
                }

                onComplete(responses)
              }

              if (data.error) {
                throw new Error(data.error)
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError)
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled
      }
      console.error('Streaming analysis error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze conversation'
      onError(errorMessage)
    } finally {
      abortControllerRef.current = null
    }
  }, [])

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      
      // Immediately update store to stop analyzing state
      if (typeof window !== 'undefined') {
        try {
          const { useInterviewStore } = require('@/lib/store')
          const { setIsAnalyzing } = useInterviewStore.getState()
          setIsAnalyzing(false)
        } catch (error) {
          // Fail silently if store is not available
          console.warn('Could not access store to stop analyzing state:', error)
        }
      }
    }
  }, [])

  return { analyzeWithStreaming, cancel }
}

