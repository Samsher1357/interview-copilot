// Parakeet-style types

export type ClosedBy = 'silence' | 'semantic' | 'stability' | 'interruption'

export interface Utterance {
  id: string
  speaker: 'user' | 'ai'
  text: string
  startTime: number
  endTime: number
  confidence: number
  closedBy: ClosedBy
}

export interface Turn {
  speaker: 'user' | 'ai'
  content: string
  timestamp: number
}

export type ConversationState = 
  | 'IDLE'
  | 'LISTENING'
  | 'USER_SPEAKING'
  | 'AI_THINKING'
  | 'AI_RESPONDING'
  | 'INTERRUPTED'

export type Intent = 
  | 'question'
  | 'explain'
  | 'clarify'
  | 'acknowledge'
  | 'filler'
  | 'thinking'
  | 'statement'
  | 'unknown'

export interface InterviewContext {
  jobRole?: string
  company?: string
  skills?: string[]
  experience?: string
  education?: string
  achievements?: string
  customNotes?: string
}
