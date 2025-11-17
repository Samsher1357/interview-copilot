import { create } from 'zustand'

export interface TranscriptEntry {
  id: string
  speaker: 'interviewer' | 'applicant' | 'system'
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

interface InterviewState {
  isListening: boolean
  transcripts: TranscriptEntry[]
  aiResponses: AIResponse[]
  currentLanguage: string
  autoSpeak: boolean
  error: string | null
  isAnalyzing: boolean
  interviewContext: InterviewContext
  showContextModal: boolean
  
  setIsListening: (isListening: boolean) => void
  addTranscript: (entry: TranscriptEntry) => void
  addAIResponse: (response: AIResponse) => void
  mergeNearbyTranscripts: () => void
  setLanguage: (lang: string) => void
  setAutoSpeak: (enabled: boolean) => void
  setError: (error: string | null) => void
  setIsAnalyzing: (isAnalyzing: boolean) => void
  setInterviewContext: (context: InterviewContext) => void
  setShowContextModal: (show: boolean) => void
  clearTranscripts: () => void
  clearResponses: () => void
}

export const useInterviewStore = create<InterviewState>((set) => ({
  isListening: false,
  transcripts: [],
  aiResponses: [],
  currentLanguage: 'en-US',
  autoSpeak: false,
  error: null,
  isAnalyzing: false,
  interviewContext: {},
  showContextModal: false,
  
  setIsListening: (isListening) => set({ isListening }),
  addTranscript: (entry) => set((state) => {
    const transcripts = [...state.transcripts]
    const lastTranscript = transcripts[transcripts.length - 1]
    
    // On mobile, merge transcripts from same speaker within 2 seconds
    const isMobile = typeof window !== 'undefined' && (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth < 768
    )
    
    if (isMobile && lastTranscript && 
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
      return { transcripts }
    }
    
    return { transcripts: [...transcripts, entry] }
  }),
  mergeNearbyTranscripts: () => set((state) => {
    const isMobile = typeof window !== 'undefined' && (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth < 768
    )
    
    if (!isMobile || state.transcripts.length < 2) {
      return state
    }
    
    const merged: TranscriptEntry[] = []
    let current = state.transcripts[0]
    
    for (let i = 1; i < state.transcripts.length; i++) {
      const next = state.transcripts[i]
      const timeDiff = next.timestamp - current.timestamp
      
      // Merge if same speaker and within 1 second (for real-time feel)
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
      return { transcripts: merged }
    }
    
    return state
  }),
  addAIResponse: (response) => set((state) => ({
    aiResponses: [...state.aiResponses, response]
  })),
  setLanguage: (lang) => set({ currentLanguage: lang }),
  setAutoSpeak: (enabled) => set({ autoSpeak: enabled }),
  setError: (error) => set({ error }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setInterviewContext: (context) => set({ interviewContext: context }),
  setShowContextModal: (show) => set({ showContextModal: show }),
  clearTranscripts: () => set({ transcripts: [] }),
  clearResponses: () => set({ aiResponses: [] }),
}))

