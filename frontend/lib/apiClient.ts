/**
 * API Client for Backend Communication
 * All API calls to the backend server should go through this service
 */

import { retryWithBackoff } from './utils/retryWithBackoff'

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
  private readonly baseUrl: string

  constructor() {
    this.baseUrl = API_BASE_URL
  }

  /**
   * Get Deepgram API key for SDK initialization
   */
  async getDeepgramConnection(): Promise<{ apiKey: string }> {
    return retryWithBackoff(async () => {
      const response = await fetch(`${this.baseUrl}/api/deepgram`, { method: 'GET' })
      
      if (!response.ok) {
        throw new Error(`Failed to get Deepgram API key: ${response.status}`)
      }
      
      return response.json()
    }, {
      maxRetries: 3,
      initialDelayMs: 500,
    })
  }

  /**
   * Parse resume text
   */
  async parseResume(resumeText: string): Promise<{ context: InterviewContext }> {
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

    return response.json()
  }

  /**
   * Parse PDF resume
   */
  async parsePDF(file: File): Promise<{ context: InterviewContext }> {
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

    return response.json()
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: number }> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    try {
      const result = await retryWithBackoff(async () => {
        const response = await fetch(`${this.baseUrl}/health`, { 
          signal: controller.signal 
        })
        
        if (!response.ok) {
          throw new Error(`Health check failed: ${response.status}`)
        }
        
        return response.json()
      }, {
        maxRetries: 1,
        initialDelayMs: 500,
      })
      
      clearTimeout(timeoutId)
      return result
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Health check timeout - server may be down')
      }
      throw error
    }
  }
}

export const apiClient = new APIClient()
