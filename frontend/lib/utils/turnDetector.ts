import { ClosedBy } from '../types'

// Filler words and phrases that should NOT trigger analysis (only exact matches)
const FILLER_PATTERNS = [
  /^(uh+|um+|hmm+|ah+|er+|oh+)$/i,
  /^(you know|i mean|basically|actually|honestly|literally)$/i,
  /^(let me think|let me see|give me a (second|moment|sec|minute))$/i,
  /^(that's a good (question|point)|interesting|good question)$/i,
]

// Incomplete sentence patterns - likely mid-thought
// IMPORTANT: Don't include question words here - they're valid endings for questions!
const INCOMPLETE_PATTERNS = [
  /\b(and|but|or|so|because|since|when|if|that|which)$/i,  // Removed question words
  /\b(the|a|an|to|for|with|in|on|at|by|from|of)$/i,
  /\b(is|are|was|were|have|has|had|do|does|did|will|would|could|should|can|may|might)$/i,
  /,$/,  // Ends with comma
]

// Strong sentence endings
const SENTENCE_ENDINGS = /[.!?]$/

// Question patterns - detect questions by structure
const QUESTION_STARTS = /^(what|why|how|who|where|when|which|can|could|would|should|do|does|did|is|are|was|were)\b/i
const QUESTION_MARK = /\?$/

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
  consecutiveFinals?: number
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
    silenceThresholdMs = 1400,  // Reduced from 1500ms for faster response
    minWords = 4,               // Reduced from 5
    minConfidence = 0.65,       // Reduced from 0.7
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

  // RULE 5: Strong semantic closure - sentence ends with punctuation
  if (SENTENCE_ENDINGS.test(trimmed) && wordCount >= minWords) {
    return { shouldClose: true, closedBy: 'semantic', reason: 'sentence complete with punctuation' }
  }

  // RULE 6: Question detection - questions are complete thoughts
  // Check for question mark OR question word at start with sufficient length
  const hasQuestionMark = QUESTION_MARK.test(trimmed)
  const startsWithQuestionWord = QUESTION_STARTS.test(trimmed)
  
  if (hasQuestionMark && wordCount >= 3) {
    return { shouldClose: true, closedBy: 'semantic', reason: 'question with question mark' }
  }
  
  if (startsWithQuestionWord && wordCount >= 4) {
    // Question word at start + enough words = likely complete question
    // But check if it ends with incomplete patterns
    if (!looksIncomplete(trimmed)) {
      return { shouldClose: true, closedBy: 'semantic', reason: 'complete question detected' }
    }
  }

  // RULE 7: Check for incomplete sentence patterns (but not questions)
  if (!startsWithQuestionWord && !hasQuestionMark && looksIncomplete(trimmed)) {
    return { shouldClose: false, closedBy: 'silence', reason: 'incomplete sentence' }
  }

  // RULE 8: Deepgram speech_final with stability check
  // For questions, be more lenient - 1 final is enough if it looks complete
  const isQuestion = startsWithQuestionWord || hasQuestionMark
  const requiredFinals = isQuestion ? 1 : 2
  
  if (speechFinal && consecutiveFinals >= requiredFinals && wordCount >= minWords) {
    return { shouldClose: true, closedBy: 'stability', reason: `stable speech final (${consecutiveFinals} finals)` }
  }

  // RULE 9: Long silence with substantial content
  // For questions, use shorter silence threshold
  const effectiveSilenceThreshold = isQuestion ? silenceThresholdMs * 0.8 : silenceThresholdMs
  
  if (silenceMs >= effectiveSilenceThreshold && wordCount >= minWords) {
    return { shouldClose: true, closedBy: 'silence', reason: `silence threshold (${silenceMs}ms)` }
  }

  return { shouldClose: false, closedBy: 'silence', reason: 'waiting for more input' }
}

function looksLikeFiller(text: string): boolean {
  const normalized = text.toLowerCase().trim()
  
  // Check against filler patterns (exact matches only)
  for (const pattern of FILLER_PATTERNS) {
    if (pattern.test(normalized)) return true
  }
  
  // Check if entire text is just short filler words
  const words = normalized.split(/\s+/)
  if (words.length <= 2) {
    const fillerWords = new Set(['uh', 'um', 'hmm', 'ah', 'er', 'oh', 'like', 'so', 'well', 'okay', 'ok'])
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
