import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ToastMessage } from '@/components/Toast'
import { Utterance, Turn, ConversationState, InterviewContext } from './types'

const MAX_TURNS = 10
const MAX_UTTERANCES = 50

export interface CopilotState {
  // Conversation FSM
  conversationState: ConversationState
  
  // Turn-based memory
  turns: Turn[]
  utterances: Utterance[]
  
  // Current streaming AI response
  streamingResponse: string | null
  streamingId: string | null
  
  // Settings
  currentLanguage: string
  simpleEnglish: boolean
  aiModel: string
  interviewContext: InterviewContext
  
  // UI state
  error: string | null
  isInterviewStarted: boolean
  sessionStartTime: number | null
  toasts: ToastMessage[]
  
  // Actions
  setConversationState: (state: ConversationState) => void
  addUtterance: (utterance: Utterance) => void
  addTurn: (turn: Turn) => void
  setStreamingResponse: (text: string | null, id?: string | null) => void
  appendStreamingChunk: (chunk: string) => void
  commitStreamingToTurn: () => void
  cancelStreaming: () => void
  
  setLanguage: (lang: string) => void
  setSimpleEnglish: (enabled: boolean) => void
  setAiModel: (model: string) => void
  setInterviewContext: (context: InterviewContext) => void
  setError: (error: string | null) => void
  setInterviewStarted: (started: boolean) => void
  
  clearSession: () => void
  reset: () => void
  
  addToast: (toast: Omit<ToastMessage, 'id'>) => void
  removeToast: (id: string) => void
}

const getLocalStorage = () => {
  if (typeof window === 'undefined') return undefined
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

const createThrottledStorage = () => {
  if (typeof window === 'undefined') {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  }
  
  const storage = getLocalStorage()
  if (!storage) {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  }

  let throttleTimer: NodeJS.Timeout | null = null
  let pendingData: { key: string; value: string } | null = null

  return {
    getItem: (key: string) => storage.getItem(key),
    setItem: (key: string, value: string) => {
      pendingData = { key, value }
      if (throttleTimer) clearTimeout(throttleTimer)
      throttleTimer = setTimeout(() => {
        if (pendingData) {
          storage.setItem(pendingData.key, pendingData.value)
          pendingData = null
        }
        throttleTimer = null
      }, 500)
    },
    removeItem: (key: string) => storage.removeItem(key),
  }
}

export const useCopilotStore = create<CopilotState>()(
  persist(
    (set, get) => ({
      conversationState: 'IDLE',
      turns: [],
      utterances: [],
      streamingResponse: null,
      streamingId: null,
      currentLanguage: 'en-US',
      simpleEnglish: false,
      aiModel: 'gpt-4o-mini',
      interviewContext: {},
      error: null,
      isInterviewStarted: false,
      sessionStartTime: null,
      toasts: [],

      setConversationState: (state) => set({ conversationState: state }),

      addUtterance: (utterance) => set((s) => {
        const utterances = [...s.utterances, utterance].slice(-MAX_UTTERANCES)
        return { utterances }
      }),

      addTurn: (turn) => set((s) => {
        const turns = [...s.turns, turn].slice(-MAX_TURNS)
        return { turns }
      }),

      setStreamingResponse: (text, id = null) => set({
        streamingResponse: text,
        streamingId: id ?? (text ? `stream-${Date.now()}` : null),
      }),

      appendStreamingChunk: (chunk) => set((s) => ({
        streamingResponse: (s.streamingResponse ?? '') + chunk,
      })),

      commitStreamingToTurn: () => {
        const { streamingResponse, streamingId } = get()
        if (!streamingResponse) return
        
        set((s) => ({
          turns: [...s.turns, {
            speaker: 'ai' as const,
            content: streamingResponse,
            timestamp: Date.now(),
          }].slice(-MAX_TURNS),
          streamingResponse: null,
          streamingId: null,
          conversationState: 'LISTENING',
        }))
      },

      cancelStreaming: () => set({
        streamingResponse: null,
        streamingId: null,
        conversationState: 'INTERRUPTED',
      }),

      setLanguage: (lang) => set({ currentLanguage: lang }),
      setSimpleEnglish: (enabled) => set({ simpleEnglish: enabled }),
      setAiModel: (model) => set({ aiModel: model }),
      setInterviewContext: (context) => set({ interviewContext: context }),
      setError: (error) => set({ error }),
      
      setInterviewStarted: (started) => set({
        isInterviewStarted: started,
        sessionStartTime: started ? Date.now() : null,
        conversationState: started ? 'LISTENING' : 'IDLE',
      }),

      clearSession: () => set({
        turns: [],
        utterances: [],
        streamingResponse: null,
        streamingId: null,
        error: null,
        conversationState: 'LISTENING',
      }),

      reset: () => set({
        conversationState: 'IDLE',
        turns: [],
        utterances: [],
        streamingResponse: null,
        streamingId: null,
        error: null,
        isInterviewStarted: false,
        sessionStartTime: null,
      }),

      addToast: (toast) => set((s) => ({
        toasts: [...s.toasts, { ...toast, id: `toast-${Date.now()}-${Math.random()}` }],
      })),
      
      removeToast: (id) => set((s) => ({
        toasts: s.toasts.filter(t => t.id !== id),
      })),
    }),
    {
      name: 'copilot-storage',
      storage: createJSONStorage(() => createThrottledStorage()),
      partialize: (state) => ({
        turns: state.turns,
        currentLanguage: state.currentLanguage,
        simpleEnglish: state.simpleEnglish,
        aiModel: state.aiModel,
        interviewContext: state.interviewContext,
      }),
      skipHydration: typeof window === 'undefined',
    }
  )
)

// Legacy export for compatibility during migration
export type { Utterance, Turn, InterviewContext }
export type TranscriptEntry = Utterance
export type AIResponse = { id: string; type: string; content: string; timestamp: number; confidence?: number }
export const useInterviewStore = useCopilotStore
