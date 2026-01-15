import { Intent } from '../types'

// Filler patterns - should NEVER trigger LLM
const FILLER_PATTERNS = [
  /^(uh+|um+|hmm+|ah+|er+|oh+|like|so|well|okay|ok)[\s.,!?]*$/i,
  /^(let me think|let me see|give me a (second|moment|sec|minute))[\s.,!?]*$/i,
  /^(you know|i mean|basically|actually|honestly|literally)[\s.,!?]*$/i,
]

// Thinking out loud - should NOT trigger LLM
const THINKING_PATTERNS = [
  /^(i('m| am) (thinking|not sure)|let me think)/i,
  /^(that's a good (question|point)|interesting|good question)/i,
  /^(hmm+|well+|so+)[\s.,!?]*$/i,
  /^(i think|i guess|i suppose|maybe|perhaps)[\s.,!?]*$/i,
]

// CONTINUE patterns - user is mid-thought, reset timers but don't commit
const CONTINUE_PATTERNS = [
  /^(what i mean is|what i('m| am) (saying|trying to say) is)/i,
  /^(so basically|in other words|to clarify)/i,
  /^(and (also|then|so)|but (also|then)|or (maybe|perhaps))/i,
  /\b(and|but|or|so|because|since|when|if|that|which)$/i,  // Ends with conjunction
  /,$/,  // Ends with comma
]

// Question patterns - SHOULD trigger LLM
const QUESTION_PATTERNS = [
  /\?$/,  // Ends with question mark
  /^(what|how|why|when|where|who|which)\s+.{10,}/i,  // Question word + substantial content
  /^(can you|could you|would you|do you|is there|are there)\s+.{10,}/i,
  /^(tell me about|explain|describe|walk me through|give me an example of)\s+.{5,}/i,
]

// Clarification requests - SHOULD trigger LLM
const CLARIFY_PATTERNS = [
  /^(sorry|pardon|what do you mean|can you repeat|i didn't (catch|hear|understand))/i,
  /^(could you clarify|what was that|come again)/i,
]

// Acknowledgment - should NOT trigger LLM
const ACKNOWLEDGE_PATTERNS = [
  /^(yes|yeah|yep|no|nope|sure|right|correct|exactly|got it|i see|understood|makes sense)[\s.,!?]*$/i,
  /^(thank you|thanks|great|good|perfect|awesome|okay|ok)[\s.,!?]*$/i,
]

// Minimum requirements for triggering LLM
const MIN_WORDS_FOR_QUESTION = 4
const MIN_WORDS_FOR_EXPLAIN = 6
const MIN_CHARS = 20

export type ExtendedIntent = Intent | 'continue'

export function classifyIntent(text: string): ExtendedIntent {
  const trimmed = text.trim()
  const lowerText = trimmed.toLowerCase()
  const wordCount = trimmed.split(/\s+/).length
  
  // Too short - likely incomplete
  if (trimmed.length < MIN_CHARS || wordCount < 3) {
    return 'filler'
  }
  
  // Check CONTINUE patterns first - user is mid-thought
  for (const pattern of CONTINUE_PATTERNS) {
    if (pattern.test(lowerText)) return 'continue'
  }
  
  // Check fillers (highest priority for rejection)
  for (const pattern of FILLER_PATTERNS) {
    if (pattern.test(lowerText)) return 'filler'
  }
  
  // Check thinking patterns
  for (const pattern of THINKING_PATTERNS) {
    if (pattern.test(lowerText)) return 'thinking'
  }
  
  // Check acknowledgments
  for (const pattern of ACKNOWLEDGE_PATTERNS) {
    if (pattern.test(lowerText)) return 'acknowledge'
  }
  
  // Check clarification requests
  for (const pattern of CLARIFY_PATTERNS) {
    if (pattern.test(lowerText)) return 'clarify'
  }
  
  // Check questions - require minimum word count
  if (wordCount >= MIN_WORDS_FOR_QUESTION) {
    for (const pattern of QUESTION_PATTERNS) {
      if (pattern.test(trimmed)) return 'question'
    }
  }
  
  // Default: if it's long enough and looks like a statement, treat as explanation request
  if (wordCount >= MIN_WORDS_FOR_EXPLAIN) {
    const hasVerb = /\b(is|are|was|were|have|has|had|do|does|did|can|could|would|should|will|want|need|like|think|know|use|work|build|create|develop|implement|design)\b/i.test(lowerText)
    const hasSubject = /\b(i|you|we|they|it|this|that|the|my|your|our)\b/i.test(lowerText)
    
    if (hasVerb && hasSubject) {
      return 'explain'
    }
  }
  
  return 'unknown'
}

export function shouldTriggerLLM(intent: ExtendedIntent): boolean {
  return intent === 'question' || intent === 'explain' || intent === 'clarify'
}

export function shouldContinueListening(intent: ExtendedIntent): boolean {
  return intent === 'continue'
}

export function getIntentDebugInfo(text: string): { intent: ExtendedIntent; shouldTrigger: boolean; shouldContinue: boolean; reason: string } {
  const intent = classifyIntent(text)
  const shouldTrigger = shouldTriggerLLM(intent)
  const shouldContinue = shouldContinueListening(intent)
  
  let reason = ''
  switch (intent) {
    case 'filler': reason = 'Detected as filler/noise'; break
    case 'thinking': reason = 'User is thinking out loud'; break
    case 'acknowledge': reason = 'Simple acknowledgment'; break
    case 'continue': reason = 'User is mid-thought, continue listening'; break
    case 'question': reason = 'Detected as question'; break
    case 'explain': reason = 'Request for explanation'; break
    case 'clarify': reason = 'Clarification request'; break
    case 'unknown': reason = 'Could not classify intent'; break
  }
  
  return { intent, shouldTrigger, shouldContinue, reason }
}
