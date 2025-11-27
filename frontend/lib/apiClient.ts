/**
 * API Client for Backend Communication
 * All API calls to the backend server should go through this service
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface TranscriptEntry {
  id: string
  text: string
  speaker: 'interviewer' | 'applicant'
  timestamp: number
  confidence?: number
}

export interface AIResponse {
  id: string
  type: 'answer' | 'suggestion' | 'hint' | 'talking-point'
  content: string
  timestamp: number
  confidence: number
}

export interface InterviewContext {
  jobRole?: string
  company?: string
  skills?: string[]
  experience?: string
  education?: string
  achievements?: string
  customNotes?: string
  resumeText?: string
}

export interface AnalysisRequest {
  transcripts: TranscriptEntry[]
  language?: string
  context?: InterviewContext
  simpleEnglish?: boolean
}

export interface AnalysisResponse {
  responses: AIResponse[]
  shouldAnalyze: boolean
  reason?: string
}

class APIClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = API_BASE_URL
  }

  /**
   * Analyze conversation (non-streaming)
   */
  async analyzeConversation(request: AnalysisRequest): Promise<AnalysisResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Analysis failed')
      }

      return await response.json()
    } catch (error) {
      console.error('API analyze error:', error)
      throw error
    }
  }

  /**
   * Analyze conversation with streaming
   */
  async *streamAnalysis(request: AnalysisRequest): AsyncGenerator<string, void, unknown> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout
    
    try {
      const response = await fetch(`${this.baseUrl}/api/analyze-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Streaming analysis failed')
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              return
            }
            try {
              const parsed = JSON.parse(data)
              if (parsed.token) {
                yield parsed.token
              } else if (parsed.error) {
                throw new Error(parsed.error)
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request aborted')
        throw new Error('Request timeout - please try again')
      }
      console.error('API stream error:', error)
      throw error
    }
  }

  /**
   * Get Deepgram connection details
   */
  async getDeepgramConnection(): Promise<{ apiKey: string; url: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/deepgram`, {
        method: 'GET',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to get Deepgram connection')
      }

      return await response.json()
    } catch (error) {
      console.error('API Deepgram error:', error)
      throw error
    }
  }

  /**
   * Parse resume text
   */
  async parseResume(resumeText: string): Promise<{ context: InterviewContext }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/parse-resume/parse-resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resumeText }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Resume parsing failed')
      }

      return await response.json()
    } catch (error) {
      console.error('API parse resume error:', error)
      throw error
    }
  }

  /**
   * Parse PDF resume
   */
  async parsePDF(file: File): Promise<{ context: InterviewContext }> {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${this.baseUrl}/api/parse-pdf`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'PDF parsing failed')
      }

      return await response.json()
    } catch (error) {
      console.error('API parse PDF error:', error)
      throw error
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: number }> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
    
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error('Health check failed')
      }

      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Health check timeout - server may be down')
      }
      console.error('API health check error:', error)
      throw error
    }
  }
}

export const apiClient = new APIClient()
