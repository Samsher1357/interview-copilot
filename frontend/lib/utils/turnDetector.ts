import { ClosedBy } from '../types'

// Filler words and phrases that should NOT trigger analysis
const FILLER_PATTERNS = [
  /^(uh+|um+|hmm+|ah+|er+|oh+)$/i,
  /^(like|so|well|okay|ok|right|yeah|yes|no|and|but|or)$/i,
  /^(you know|i mean|basically|actually|honestly|literally)$/i,
  /^(let me think|let me see|give me a (second|moment|sec|minute))$/i,
  /^(that's a good (question|point)|interesting|good question)$/i,
  /^(so basically|well actually|i think|i guess|i suppose)$/i,
]

// Incomplete sentence patterns - likely mid-thought
const INCOMPLETE_PATTERNS = [
  /\b(and|but|or|so|because|since|when|if|that|which|who|where|how|what|why)$/i,
  /\b(the|a|an|to|for|with|in|on|at|by|from|of)$/i,
  /\b(is|are|was|were|have|has|had|do|does|did|will|would|could|should|can|may|might)$/i,
  /,$/,  // Ends with comma
]

// Strong sentence endings
const SENTENCE_ENDINGS = /[.!?]$/

interface TurnDetectorConfig {
  silenceThresholdMs?: number
  minWords?: number
  minConfidence?: number
}

interface TurnDetectorInput {
  text: string
  silenceMs: number
  confidence: number
  isFinal: boolean
  speechFinal: boolean
  consecutiveFinals?: number  // How many consecutive final results we've seen
}

interface TurnDetectorResult {
  shouldClose: boolean
  closedBy: ClosedBy
  reason: string
}

export function detectTurnEnd(
  input: TurnDetectorInput,
  config: TurnDetectorConfig = {}
): TurnDetectorResult {
  const {
    silenceThresholdMs = 1500,  // Increased from 900ms
    minWords = 5,               // Increased from 4
    minConfidence = 0.7,        // Increased from 0.6
  } = config

  const { text, silenceMs, confidence, isFinal, speechFinal, consecutiveFinals = 0 } = input
  const trimmed = text.trim()
  const lowerText = trimmed.toLowerCase()
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)
  const wordCount = words.length

  // RULE 1: Never close on non-final results
  if (!isFinal) {
    return { shouldClose: false, closedBy: 'silence', reason: 'interim result' }
  }

  // RULE 2: Too short - definitely not complete
  if (wordCount < minWords) {
    return { shouldClose: false, closedBy: 'silence', reason: `too short (${wordCount}/${minWords} words)` }
  }

  // RULE 3: Low confidence - unreliable
  if (confidence < minConfidence) {
    return { shouldClose: false, closedBy: 'silence', reason: `low confidence (${confidence.toFixed(2)})` }
  }

  // RULE 4: Check if it's just filler
  if (looksLikeFiller(lowerText)) {
    return { shouldClose: false, closedBy: 'silence', reason: 'filler detected' }
  }

  // RULE 5: Check for incomplete sentence patterns
  if (looksIncomplete(trimmed)) {
    return { shouldClose: false, closedBy: 'silence', reason: 'incomplete sentence' }
  }

  // RULE 6: Strong semantic closure - sentence ends with punctuation
  if (SENTENCE_ENDINGS.test(trimmed) && wordCount >= minWords) {
    return { shouldClose: true, closedBy: 'semantic', reason: 'sentence complete with punctuation' }
  }

  // RULE 7: Deepgram speech_final with stability check
  // Require at least 2 consecutive finals to avoid false positives
  if (speechFinal && consecutiveFinals >= 2 && wordCount >= minWords) {
    return { shouldClose: true, closedBy: 'stability', reason: 'stable speech final' }
  }

  // RULE 8: Long silence with substantial content
  if (silenceMs >= silenceThresholdMs && wordCount >= minWords + 2) {
    return { shouldClose: true, closedBy: 'silence', reason: `silence threshold (${silenceMs}ms)` }
  }

  return { shouldClose: false, closedBy: 'silence', reason: 'waiting for more input' }
}

function looksLikeFiller(text: string): boolean {
  const normalized = text.toLowerCase().trim()
  
  // Check against filler patterns
  for (const pattern of FILLER_PATTERNS) {
    if (pattern.test(normalized)) return true
  }
  
  // Check if entire text is just short filler words
  const words = normalized.split(/\s+/)
  if (words.length <= 3) {
    const fillerWords = new Set(['uh', 'um', 'hmm', 'ah', 'er', 'oh', 'like', 'so', 'well', 'okay', 'ok', 'and', 'but', 'or', 'the', 'a', 'i'])
    return words.every(w => fillerWords.has(w) || w.length <= 2)
  }
  
  return false
}

function looksIncomplete(text: string): boolean {
  const trimmed = text.trim()
  
  // Check against incomplete patterns
  for (const pattern of INCOMPLETE_PATTERNS) {
    if (pattern.test(trimmed)) return true
  }
  
  return false
}

export function isInterruption(
  currentState: string,
  newSpeechDetected: boolean
): boolean {
  return currentState === 'AI_RESPONDING' && newSpeechDetected
}
