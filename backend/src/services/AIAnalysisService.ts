import { TranscriptEntry, AIResponse } from '../types'
import { langchainService } from './langchainService'

export interface AnalysisOptions {
  language: string
  context?: any
  maxHistory?: number
}

export interface AnalysisResult {
  responses: AIResponse[]
  shouldAnalyze: boolean
  reason?: string
}

export class AIAnalysisService {
  private readonly DEFAULT_MAX_HISTORY = 12

  async analyze(
    transcripts: TranscriptEntry[],
    options: AnalysisOptions
  ): Promise<AnalysisResult> {
    const { language, context, maxHistory = this.DEFAULT_MAX_HISTORY } = options

    if (transcripts.length === 0) {
      return { responses: [], shouldAnalyze: false, reason: 'No transcripts' }
    }

    const recentTranscripts = transcripts.slice(-maxHistory)

    try {
      const responses = await langchainService.analyzeConversation(
        recentTranscripts,
        language,
        context
      )

      return { responses, shouldAnalyze: true }
    } catch (error) {
      console.error('AI analysis failed:', error)
      throw error
    }
  }

  async* streamAnalysis(
    transcripts: TranscriptEntry[],
    options: AnalysisOptions
  ): AsyncGenerator<string, AnalysisResult, unknown> {
    const { language, context, maxHistory = this.DEFAULT_MAX_HISTORY } = options

    if (transcripts.length === 0) {
      return { responses: [], shouldAnalyze: false, reason: 'No transcripts' }
    }

    const recentTranscripts = transcripts.slice(-maxHistory)

    let fullResponse = ''

    try {
      for await (const chunk of langchainService.streamAnalysis(
        recentTranscripts,
        language,
        context
      )) {
        fullResponse += chunk
        yield chunk
      }

      const parsed = this.parseStreamedResponse(fullResponse)
      const responses = this.convertToAIResponses(parsed)

      return { responses, shouldAnalyze: true }
    } catch (error) {
      console.error('Streaming analysis failed:', error)
      throw error
    }
  }

  private parseStreamedResponse(response: string): any {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
        response.match(/```\s*([\s\S]*?)\s*```/) ||
        [null, response]

      const jsonString = jsonMatch[1] || response
      return JSON.parse(jsonString)
    } catch (error) {
      console.error('Failed to parse streamed response:', response)
      return {
        intent: 'general',
        context: 'Unparsed response',
        answer: response,
        suggestions: [],
        hints: [],
        talkingPoints: [],
      }
    }
  }

  private convertToAIResponses(parsed: any): AIResponse[] {
    const responses: AIResponse[] = []
    const timestamp = Date.now()

    if (parsed.answer && parsed.answer.trim()) {
      responses.push({
        id: `answer-${timestamp}`,
        type: 'answer',
        content: parsed.answer,
        timestamp,
        confidence: 0.9,
      })
    }

    return responses
  }
}

export const aiAnalysisService = new AIAnalysisService()

