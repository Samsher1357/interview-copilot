export interface TranscriptEntry {
  id: string
  speaker: 'user' | 'system'
  text: string
  timestamp: number
}

export interface AIResponse {
  id: string
  type: 'suggestion' | 'hint' | 'talking-point' | 'answer'
  content: string
  timestamp: number
  confidence?: number
}

export interface InterviewContext {
  jobRole?: string
  company?: string
  skills?: string[]
  experience?: string
  education?: string
  achievements?: string
  customNotes?: string
}

