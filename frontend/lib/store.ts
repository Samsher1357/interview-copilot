import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ToastMessage } from '@/components/Toast'

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

// Memory management constants
const MAX_TRANSCRIPTS = 100
const MAX_AI_RESPONSES = 50

interface InterviewState {
  isListening: boolean
  transcripts: TranscriptEntry[]
  aiResponses: AIResponse[]
  currentLanguage: string
  simpleEnglish: boolean
  aiModel: string
  error: string | null
  isAnalyzing: boolean
  interviewContext: InterviewContext
  sessionStartTime: number | null
  toasts: ToastMessage[]
  
  setIsListening: (isListening: boolean) => void
  addTranscript: (entry: TranscriptEntry) => void
  addAIResponse: (response: AIResponse) => void
  updateAIResponse: (id: string, updates: Partial<AIResponse>) => void
  removeAIResponse: (id: string) => void
  setLanguage: (lang: string) => void
  setSimpleEnglish: (enabled: boolean) => void
  setAiModel: (model: string) => void
  setError: (error: string | null) => void
  setIsAnalyzing: (isAnalyzing: boolean) => void
  setInterviewContext: (context: InterviewContext) => void
  clearTranscripts: () => void
  clearResponses: () => void
  clearAll: () => void
  addToast: (toast: Omit<ToastMessage, 'id'>) => void
  removeToast: (id: string) => void
  showToast: (type: ToastMessage['type'], message: string, description?: string) => void
}

// Helper to safely access localStorage
const getLocalStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined
  } catch {
    return undefined
  }
}

export const useInterviewStore = create<InterviewState>()(
  persist(
    (set, get) => ({
      isListening: false,
      transcripts: [],
      aiResponses: [],
      currentLanguage: 'en-US',
      simpleEnglish: false,
      aiModel: 'gpt-4o-mini',
      error: null,
      isAnalyzing: false,
      interviewContext: {},
      sessionStartTime: null,
      toasts: [],
  
  setIsListening: (isListening) => set((state) => ({
    isListening,
    sessionStartTime: isListening && !state.sessionStartTime ? Date.now() : state.sessionStartTime
  })),
  addTranscript: (entry) => {
    const state = get()
    let transcripts = [...state.transcripts]
    const lastTranscript = transcripts[transcripts.length - 1]
    
    // Merge transcripts from same speaker within 1 second
    if (lastTranscript && 
        lastTranscript.speaker === entry.speaker &&
        entry.timestamp - lastTranscript.timestamp < 1000) {
      const merged: TranscriptEntry = {
        id: lastTranscript.id,
        speaker: lastTranscript.speaker,
        text: `${lastTranscript.text} ${entry.text}`.trim(),
        timestamp: lastTranscript.timestamp,
      }
      transcripts[transcripts.length - 1] = merged
    } else {
      transcripts.push(entry)
    }
    
    // Auto-cleanup if exceeding limit
    if (transcripts.length > MAX_TRANSCRIPTS) {
      transcripts = transcripts.slice(-MAX_TRANSCRIPTS)
    }
    
    set({ transcripts })
  },
  addAIResponse: (response) => set((state) => {
    let aiResponses = [...state.aiResponses, response]
    
    // Auto-cleanup if exceeding limit
    if (aiResponses.length > MAX_AI_RESPONSES) {
      aiResponses = aiResponses.slice(-MAX_AI_RESPONSES)
    }
    
    return { aiResponses }
  }),
  updateAIResponse: (id, updates) => set((state) => ({
    aiResponses: state.aiResponses.map(r => 
      r.id === id ? { ...r, ...updates } : r
    )
  })),
  removeAIResponse: (id) => set((state) => ({
    aiResponses: state.aiResponses.filter(r => r.id !== id)
  })),
  setLanguage: (lang) => set({ currentLanguage: lang }),
  setSimpleEnglish: (enabled) => set({ simpleEnglish: enabled }),
  setAiModel: (model) => set({ aiModel: model }),
  setError: (error) => set({ error }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setInterviewContext: (context) => set({ interviewContext: context }),
  clearTranscripts: () => set({ transcripts: [] }),
  clearResponses: () => set({ aiResponses: [] }),
  clearAll: () => set({
    transcripts: [],
    aiResponses: [],
    sessionStartTime: null,
    isListening: false,
    error: null,
  }),
  addToast: (toast) => set((state) => ({
    toasts: [...state.toasts, { ...toast, id: `toast-${Date.now()}-${Math.random()}` }]
  })),
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  })),
  showToast: (type, message, description) => {
    const toast: Omit<ToastMessage, 'id'> = { type, message, description }
    get().addToast(toast)
  },
}),
    {
      name: 'interview-copilot-storage',
      storage: createJSONStorage(() => getLocalStorage() || ({
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      })),
      partialize: (state) => ({
        transcripts: state.transcripts,
        aiResponses: state.aiResponses,
        currentLanguage: state.currentLanguage,
        simpleEnglish: state.simpleEnglish,
        aiModel: state.aiModel,
        interviewContext: state.interviewContext,
        sessionStartTime: state.sessionStartTime,
      }),
    }
  )
)

