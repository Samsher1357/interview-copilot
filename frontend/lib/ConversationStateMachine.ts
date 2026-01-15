import { ConversationState } from './types'

type StateTransition = {
  from: ConversationState | '*'
  event: ConversationEvent
  to: ConversationState
  action?: () => void
}

export type ConversationEvent =
  | 'START_INTERVIEW'
  | 'STOP_INTERVIEW'
  | 'SPEECH_START'
  | 'SPEECH_END'
  | 'UTTERANCE_COMPLETE'
  | 'ANALYSIS_START'
  | 'ANALYSIS_CHUNK'
  | 'ANALYSIS_COMPLETE'
  | 'ANALYSIS_ERROR'
  | 'USER_INTERRUPT'
  | 'RESET'

interface StateMachineCallbacks {
  onCancelAnalysis?: () => void
  onDropPendingAnalysis?: () => void
  onResetTimers?: () => void
}

export class ConversationStateMachine {
  private state: ConversationState = 'IDLE'
  private callbacks: StateMachineCallbacks = {}
  private listeners: Set<(state: ConversationState) => void> = new Set()
  private generationId: number = 0

  // State transition rules - Parakeet style
  private readonly transitions: StateTransition[] = [
    // From IDLE
    { from: 'IDLE', event: 'START_INTERVIEW', to: 'LISTENING' },
    
    // From LISTENING
    { from: 'LISTENING', event: 'SPEECH_START', to: 'USER_SPEAKING' },
    { from: 'LISTENING', event: 'STOP_INTERVIEW', to: 'IDLE' },
    
    // From USER_SPEAKING
    { from: 'USER_SPEAKING', event: 'SPEECH_END', to: 'LISTENING' },
    { from: 'USER_SPEAKING', event: 'UTTERANCE_COMPLETE', to: 'LISTENING' },
    { from: 'USER_SPEAKING', event: 'STOP_INTERVIEW', to: 'IDLE' },
    
    // From LISTENING to AI
    { from: 'LISTENING', event: 'ANALYSIS_START', to: 'AI_THINKING' },
    
    // From AI_THINKING
    { from: 'AI_THINKING', event: 'ANALYSIS_CHUNK', to: 'AI_RESPONDING' },
    { from: 'AI_THINKING', event: 'ANALYSIS_COMPLETE', to: 'LISTENING' },
    { from: 'AI_THINKING', event: 'ANALYSIS_ERROR', to: 'LISTENING' },
    { from: 'AI_THINKING', event: 'SPEECH_START', to: 'INTERRUPTED' },
    { from: 'AI_THINKING', event: 'UTTERANCE_COMPLETE', to: 'INTERRUPTED' },
    { from: 'AI_THINKING', event: 'USER_INTERRUPT', to: 'INTERRUPTED' },
    { from: 'AI_THINKING', event: 'STOP_INTERVIEW', to: 'IDLE' },
    
    // From AI_RESPONDING
    { from: 'AI_RESPONDING', event: 'ANALYSIS_CHUNK', to: 'AI_RESPONDING' },
    { from: 'AI_RESPONDING', event: 'ANALYSIS_COMPLETE', to: 'LISTENING' },
    { from: 'AI_RESPONDING', event: 'ANALYSIS_ERROR', to: 'LISTENING' },
    { from: 'AI_RESPONDING', event: 'SPEECH_START', to: 'INTERRUPTED' },
    { from: 'AI_RESPONDING', event: 'UTTERANCE_COMPLETE', to: 'INTERRUPTED' },
    { from: 'AI_RESPONDING', event: 'USER_INTERRUPT', to: 'INTERRUPTED' },
    { from: 'AI_RESPONDING', event: 'STOP_INTERVIEW', to: 'IDLE' },
    
    // From INTERRUPTED
    { from: 'INTERRUPTED', event: 'SPEECH_START', to: 'USER_SPEAKING' },
    { from: 'INTERRUPTED', event: 'UTTERANCE_COMPLETE', to: 'LISTENING' },
    { from: 'INTERRUPTED', event: 'ANALYSIS_COMPLETE', to: 'LISTENING' },
    { from: 'INTERRUPTED', event: 'ANALYSIS_ERROR', to: 'LISTENING' },
    { from: 'INTERRUPTED', event: 'STOP_INTERVIEW', to: 'IDLE' },
    
    // Global reset
    { from: '*', event: 'RESET', to: 'IDLE' },
    { from: '*', event: 'STOP_INTERVIEW', to: 'IDLE' },
  ]

  constructor(callbacks: StateMachineCallbacks = {}) {
    this.callbacks = callbacks
  }

  getState(): ConversationState {
    return this.state
  }

  getGenerationId(): number {
    return this.generationId
  }

  newGeneration(): number {
    this.generationId++
    return this.generationId
  }

  isGenerationValid(id: number): boolean {
    return id === this.generationId
  }

  subscribe(listener: (state: ConversationState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.listeners.forEach(l => l(this.state))
  }

  dispatch(event: ConversationEvent): boolean {
    const transition = this.transitions.find(
      t => (t.from === this.state || t.from === '*') && t.event === event
    )

    if (!transition) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[FSM] Invalid transition: ${this.state} + ${event}`)
      }
      return false
    }

    const prevState = this.state
    this.state = transition.to

    if (process.env.NODE_ENV === 'development') {
      console.log(`[FSM] ${prevState} --[${event}]--> ${this.state}`)
    }

    // Execute side effects based on transition
    this.executeSideEffects(prevState, event, this.state)

    // Execute custom action if provided
    transition.action?.()

    // Notify listeners
    this.notify()

    return true
  }

  private executeSideEffects(from: ConversationState, event: ConversationEvent, to: ConversationState) {
    // Cancel analysis when interrupted
    if (to === 'INTERRUPTED' && (from === 'AI_THINKING' || from === 'AI_RESPONDING')) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[FSM] Side effect: Cancelling analysis due to interruption`)
      }
      this.callbacks.onCancelAnalysis?.()
      this.newGeneration() // Invalidate current generation
    }

    // Drop pending analysis when new utterance arrives during thinking
    if (from === 'AI_THINKING' && event === 'UTTERANCE_COMPLETE') {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[FSM] Side effect: Dropping pending analysis`)
      }
      this.callbacks.onDropPendingAnalysis?.()
    }

    // Reset timers on state changes that need it
    if (to === 'LISTENING' || to === 'IDLE') {
      this.callbacks.onResetTimers?.()
    }

    // New generation when starting analysis
    if (event === 'ANALYSIS_START') {
      this.newGeneration()
    }
  }

  // Helper methods for common checks
  canStartAnalysis(): boolean {
    return this.state === 'LISTENING'
  }

  canReceiveChunks(): boolean {
    return this.state === 'AI_THINKING' || this.state === 'AI_RESPONDING'
  }

  isUserActive(): boolean {
    return this.state === 'USER_SPEAKING' || this.state === 'INTERRUPTED'
  }

  isAIActive(): boolean {
    return this.state === 'AI_THINKING' || this.state === 'AI_RESPONDING'
  }

  shouldListenToMic(): boolean {
    return this.state === 'LISTENING' || this.state === 'USER_SPEAKING' || this.state === 'INTERRUPTED'
  }
}

// Singleton instance
let instance: ConversationStateMachine | null = null

export function getStateMachine(callbacks?: StateMachineCallbacks): ConversationStateMachine {
  if (!instance) {
    instance = new ConversationStateMachine(callbacks)
  } else if (callbacks) {
    // Update callbacks if provided
    instance = new ConversationStateMachine(callbacks)
  }
  return instance
}

export function resetStateMachine(): void {
  instance = null
}
