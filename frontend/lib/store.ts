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
const MAX_TRANSCRIPTS = 100 // Keep last 100 transcripts
const MAX_AI_RESPONSES = 50 // Keep last 50 AI responses
const CLEANUP_THRESHOLD = 120 // Trigger cleanup when exceeding this
const CLEANUP_INTERVAL = 60000 // Auto-cleanup every 60 seconds

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
  mergeNearbyTranscripts: () => void
  setLanguage: (lang: string) => void
  setSimpleEnglish: (enabled: boolean) => void
  setAiModel: (model: string) => void
  setError: (error: string | null) => void
  setIsAnalyzing: (isAnalyzing: boolean) => void
  setInterviewContext: (context: InterviewContext) => void
  clearTranscripts: () => void
  clearResponses: () => void
  clearAll: () => void
  exportData: () => string
  addToast: (toast: Omit<ToastMessage, 'id'>) => void
  removeToast: (id: string) => void
  showToast: (type: ToastMessage['type'], message: string, description?: string) => void
  cleanupOldData: () => void
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
      // Merge with last transcript
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
    
    // Auto-cleanup if exceeding threshold
    if (transcripts.length > CLEANUP_THRESHOLD) {
      transcripts = transcripts.slice(-MAX_TRANSCRIPTS)
    }
    
    set({ transcripts })
  },
  mergeNearbyTranscripts: () => {
    const state = get()
    if (state.transcripts.length < 2) {
      return
    }
    
    const merged: TranscriptEntry[] = []
    let current = state.transcripts[0]
    
    for (let i = 1; i < state.transcripts.length; i++) {
      const next = state.transcripts[i]
      const timeDiff = next.timestamp - current.timestamp
      
      // Merge if same speaker and within 1 second
      if (current.speaker === next.speaker && timeDiff < 1000) {
        current = {
          id: current.id,
          speaker: current.speaker,
          text: `${current.text} ${next.text}`.trim(),
          timestamp: current.timestamp,
        }
      } else {
        merged.push(current)
        current = next
      }
    }
    
    merged.push(current)
    
    // Only update if we actually merged something
    if (merged.length < state.transcripts.length) {
      set({ transcripts: merged })
    }
  },
  addAIResponse: (response) => set((state) => {
    let aiResponses = [...state.aiResponses, response]
    
    // Auto-cleanup if exceeding threshold
    if (aiResponses.length > CLEANUP_THRESHOLD) {
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
  exportData: () => {
    const state = get()
    return JSON.stringify({
      sessionStartTime: state.sessionStartTime,
      interviewContext: state.interviewContext,
      transcripts: state.transcripts,
      aiResponses: state.aiResponses,
      exportedAt: Date.now(),
    }, null, 2)
  },
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
  cleanupOldData: () => set((state) => ({
    transcripts: state.transcripts.slice(-MAX_TRANSCRIPTS),
    aiResponses: state.aiResponses.slice(-MAX_AI_RESPONSES),
  })),
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

