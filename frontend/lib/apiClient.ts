/**
 * API Client for Backend Communication
 * All API calls to the backend server should go through this service
 */

import { fetchWithRetry, APIError, formatErrorMessage } from './utils/apiUtils'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

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

class APIClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = API_BASE_URL
  }

  /**
   * Get Deepgram connection details
   */
  async getDeepgramConnection(): Promise<{ apiKey: string; url: string }> {
    try {
      return await fetchWithRetry<{ apiKey: string; url: string }>(
        `${this.baseUrl}/api/deepgram`,
        { method: 'GET' },
        { maxRetries: 3, baseDelay: 500 }
      )
    } catch (error) {
      const formatted = formatErrorMessage(error)
      throw new APIError(
        formatted.message || 'Failed to get Deepgram connection',
        error instanceof APIError ? error.statusCode : undefined,
        { description: formatted.description }
      )
    }
  }

  /**
   * Parse resume text
   */
  async parseResume(resumeText: string): Promise<{ context: InterviewContext }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/resume/parse`, {
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

      const response = await fetch(`${this.baseUrl}/api/resume/pdf`, {
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
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    try {
      const result = await fetchWithRetry<{ status: string; timestamp: number }>(
        `${this.baseUrl}/health`,
        { signal: controller.signal },
        { maxRetries: 1, baseDelay: 500 }
      )
      
      clearTimeout(timeoutId)
      return result
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new APIError('Health check timeout - server may be down', 408)
      }
      throw error
    }
  }
}

export const apiClient = new APIClient()
