import { NextRequest } from 'next/server'
import { langchainService } from '@/lib/langchainService'
import { TranscriptEntry } from '@/lib/store'
import { UserRole } from '@/lib/services/AIAnalysisService'

const MAX_TRANSCRIPTS_FOR_ANALYSIS = 12

export async function POST(request: NextRequest) {
  try {
    const { transcripts, language, interviewContext = {}, userRole = 'applicant', simpleEnglish = false } = await request.json()

    if (!transcripts || transcripts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No transcripts provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let isClosed = false
        
        const safeEnqueue = (data: Uint8Array): boolean => {
          if (isClosed) {
            return false
          }
          try {
            controller.enqueue(data)
            return true
          } catch (error) {
            // Controller was closed (likely client disconnected)
            if (error instanceof Error && error.message.includes('closed')) {
              isClosed = true
              return false
            }
            console.error('Failed to enqueue data:', error)
            isClosed = true
            return false
          }
        }
        
        const safeClose = () => {
          if (!isClosed) {
            try {
              controller.close()
              isClosed = true
            } catch (error) {
              console.error('Failed to close controller:', error)
              isClosed = true
            }
          }
        }
        
        try {
          const trimmedTranscripts = (transcripts as TranscriptEntry[]).slice(
            -MAX_TRANSCRIPTS_FOR_ANALYSIS
          )
          let fullResponse = ''
          let buffer = ''
          let chunkCount = 0
          
          // OPTIMIZED: Ultra-fast streaming with minimal buffering
          for await (const chunk of langchainService.streamAnalysis(
            trimmedTranscripts,
            language || 'en',
            interviewContext,
            userRole as UserRole,
            simpleEnglish
          )) {
            fullResponse += chunk
            buffer += chunk
            chunkCount++
            
            // BLAZING FAST: Send immediately for instant feedback
            // Only buffer words to avoid character-by-character sending
            const shouldSend = 
              buffer.length >= 10 || // Send after just 10 chars for ultra-fast feel
              buffer.includes(' ') && buffer.length >= 3 || // Send after word boundaries
              buffer.includes('\n') || // Send on newlines
              /[.!?:,]\s?/.test(buffer) || // Send after punctuation
              chunkCount % 2 === 0 // Or every 2 chunks for maximum responsiveness
            
            if (shouldSend && buffer.trim().length > 0) {
              const success = safeEnqueue(
                encoder.encode(`data: ${JSON.stringify({ chunk: buffer, done: false })}\n\n`)
              )
              if (!success) {
                console.log('Stream closed by client, stopping processing')
                return
              }
              buffer = ''
            }
          }
          
          // Send any remaining buffered content
          if (buffer.trim().length > 0) {
            const success = safeEnqueue(
              encoder.encode(`data: ${JSON.stringify({ chunk: buffer, done: false })}\n\n`)
            )
            if (!success) {
              console.log('Stream closed, cannot send final buffer')
              return
            }
          }

          // Check if stream is still open before sending final result
          if (isClosed) {
            console.log('Stream closed, skipping final result')
            return
          }

          // Send the final result with the complete answer
          const parsed = {
            intent: 'general',
            context: 'Streamed response',
            answer: fullResponse.trim(),
            suggestions: [],
            hints: [],
            talkingPoints: [],
          }
          
          // Send the final parsed result
          safeEnqueue(
            encoder.encode(`data: ${JSON.stringify({ result: parsed, done: true })}\n\n`)
          )
          
          safeClose()
        } catch (error) {
          console.error('Streaming error:', error)
          const errorMessage = error instanceof Error ? error.message : 'Internal server error'
          safeEnqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errorMessage, done: true })}\n\n`)
          )
          safeClose()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

