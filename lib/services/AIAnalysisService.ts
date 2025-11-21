/**
 * AI Analysis Service
 * Handles all AI-powered analysis with role-aware strategies
 * Supports both interviewer and applicant modes with different prompts
 */

import { TranscriptEntry, AIResponse, InterviewContext } from '../store'
import { langchainService } from '../langchainService'
import { responseCacheService } from './ResponseCache'

export type UserRole = 'interviewer' | 'applicant' | 'both'

export interface AnalysisOptions {
  role: UserRole
  language: string
  context?: InterviewContext
  maxHistory?: number
}

export interface AnalysisResult {
  responses: AIResponse[]
  shouldAnalyze: boolean
  reason?: string
}

export class AIAnalysisService {
  private readonly DEFAULT_MAX_HISTORY = 12

  /**
   * Analyze conversation based on role and context
   * Returns AI responses appropriate for the user's role
   * OPTIMIZED: With caching for instant responses to common questions
   */
  async analyze(
    transcripts: TranscriptEntry[],
    options: AnalysisOptions
  ): Promise<AnalysisResult> {
    const { role, language, context, maxHistory = this.DEFAULT_MAX_HISTORY } = options

    if (transcripts.length === 0) {
      return { responses: [], shouldAnalyze: false, reason: 'No transcripts' }
    }

    // Trim to recent history
    const recentTranscripts = transcripts.slice(-maxHistory)
    const latestEntry = recentTranscripts[recentTranscripts.length - 1]

    // Determine if we should analyze based on role
    const shouldAnalyze = this.shouldAnalyzeForRole(latestEntry, role)
    
    if (!shouldAnalyze.should) {
      return { responses: [], shouldAnalyze: false, reason: shouldAnalyze.reason }
    }

    // PERFORMANCE BOOST: Check cache for similar questions
    const cacheKey = latestEntry.text
    const cachedResponses = responseCacheService.get(cacheKey)
    
    if (cachedResponses) {
      console.log('⚡ Using cached response - INSTANT!')
      return { responses: cachedResponses, shouldAnalyze: true }
    }

    try {
      // Generate responses based on role
      const responses = await langchainService.analyzeConversation(
        recentTranscripts,
        language,
        context,
        undefined,
        role
      )

      // Cache the response for future use
      if (responses.length > 0) {
        responseCacheService.set(cacheKey, responses)
      }

      return { responses, shouldAnalyze: true }
    } catch (error) {
      console.error('AI analysis failed:', error)
      throw error
    }
  }

  /**
   * Stream analysis with real-time token updates
   */
  async* streamAnalysis(
    transcripts: TranscriptEntry[],
    options: AnalysisOptions
  ): AsyncGenerator<string, AnalysisResult, unknown> {
    const { role, language, context, maxHistory = this.DEFAULT_MAX_HISTORY } = options

    if (transcripts.length === 0) {
      return { responses: [], shouldAnalyze: false, reason: 'No transcripts' }
    }

    const recentTranscripts = transcripts.slice(-maxHistory)
    const latestEntry = recentTranscripts[recentTranscripts.length - 1]

    const shouldAnalyze = this.shouldAnalyzeForRole(latestEntry, role)
    
    if (!shouldAnalyze.should) {
      return { responses: [], shouldAnalyze: false, reason: shouldAnalyze.reason }
    }

    let fullResponse = ''

    try {
      // Stream tokens
      for await (const chunk of langchainService.streamAnalysis(
        recentTranscripts,
        language,
        context,
        role
      )) {
        fullResponse += chunk
        yield chunk
      }

      // Parse final response
      const parsed = this.parseStreamedResponse(fullResponse)
      const responses = this.convertToAIResponses(parsed)

      return { responses, shouldAnalyze: true }
    } catch (error) {
      console.error('Streaming analysis failed:', error)
      throw error
    }
  }

  /**
   * Determine if we should analyze based on user role and latest speaker
   */
  private shouldAnalyzeForRole(
    latestEntry: TranscriptEntry,
    role: UserRole
  ): { should: boolean; reason: string } {
    switch (role) {
      case 'interviewer':
        // Interviewer mode: analyze when applicant speaks (to help evaluate)
        if (latestEntry.speaker === 'applicant') {
          return { should: true, reason: 'Applicant spoke, analyzing for interviewer' }
        }
        return { should: false, reason: 'Interviewer spoke, no analysis needed' }

      case 'applicant':
        // Applicant mode: analyze when interviewer speaks (to help answer)
        if (latestEntry.speaker === 'interviewer') {
          return { should: true, reason: 'Interviewer spoke, analyzing for applicant' }
        }
        return { should: false, reason: 'Applicant spoke, no analysis needed' }

      case 'both':
        // Both mode: analyze every speaker change for comprehensive assistance
        return { should: true, reason: 'Both mode, analyzing all speech' }

      default:
        return { should: false, reason: 'Unknown role' }
    }
  }

  /**
   * Parse streamed JSON response
   */
  private parseStreamedResponse(response: string): any {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                       response.match(/```\s*([\s\S]*?)\s*```/) ||
                       [null, response]
      
      const jsonString = jsonMatch[1] || response
      return JSON.parse(jsonString)
    } catch (error) {
      console.error('Failed to parse streamed response:', response)
      // Return raw response as answer
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

  /**
   * Convert parsed analysis to AIResponse array
   * OPTIMIZED: Return ONLY answer for maximum speed
   */
  private convertToAIResponses(parsed: any): AIResponse[] {
    const responses: AIResponse[] = []
    const timestamp = Date.now()

    // ONLY return answer - skip suggestions, hints, talking points
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

