import { NextRequest, NextResponse } from 'next/server'
import { langchainService } from '@/lib/langchainService'
import { TranscriptEntry } from '@/lib/store'

export async function POST(request: NextRequest) {
  try {
    const { transcripts, language, interviewContext = {} } = await request.json()

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    if (!transcripts || transcripts.length === 0) {
      return NextResponse.json(
        { error: 'No transcripts provided' },
        { status: 400 }
      )
    }

    // Use langchain service for analysis
    const analysis = await langchainService.analyzeConversation(
      transcripts as TranscriptEntry[],
      language || 'en',
      interviewContext
    )

    // Convert AIResponse[] to the expected format
    const answerResponse = analysis.find(r => r.type === 'answer')
    const suggestionResponse = analysis.find(r => r.type === 'suggestion')
    const hintResponse = analysis.find(r => r.type === 'hint')
    const talkingPointResponse = analysis.find(r => r.type === 'talking-point')

    const content = {
      intent: 'general',
      context: '',
      answer: answerResponse?.content || '',
      suggestions: suggestionResponse ? [suggestionResponse.content] : [],
      hints: hintResponse ? [hintResponse.content] : [],
      talkingPoints: talkingPointResponse ? [talkingPointResponse.content] : [],
    }

    return NextResponse.json({
      intent: content.intent || 'general',
      context: content.context || '',
      answer: content.answer || '',
      suggestions: content.suggestions || [],
      hints: content.hints || [],
      talkingPoints: content.talkingPoints || [],
    })
  } catch (error) {
    console.error('API route error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

