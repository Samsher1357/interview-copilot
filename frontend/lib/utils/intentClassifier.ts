import { Intent } from '../types'

// Filler patterns - should NEVER trigger LLM
const FILLER_PATTERNS = [
  /^(uh+|um+|hmm+|ah+|er+|oh+)[\s.,!?]*$/i,
  /^(let me think|let me see|give me a (second|moment|sec|minute))[\s.,!?]*$/i,
]

// Thinking out loud - should NOT trigger LLM (but only if it's the ENTIRE utterance)
const THINKING_PATTERNS = [
  /^(that's a good (question|point)|interesting|good question)[\s.,!?]*$/i,
  /^(hmm+|well+)[\s.,!?]*$/i,
]

// CONTINUE patterns - user is mid-thought, reset timers but don't commit
// IMPORTANT: Only match if at START of utterance, not if question words present
const CONTINUE_PATTERNS = [
  /^(what i mean is|what i('m| am) (saying|trying to say) is)/i,
  /^(so basically|in other words|to clarify|let me explain)/i,
  /^(and (also|then)|but (also|then)|or (maybe|perhaps))\s/i,  // Must have space after
]

// Question patterns - SHOULD trigger LLM
const QUESTION_PATTERNS = [
  /\?$/,  // Ends with question mark
  /^(what|how|why|when|where|who|which)\b/i,  // Question word at start
  /^(can you|could you|would you|do you|is there|are there|have you|did you|will you)\b/i,
  /^(tell me|explain|describe|walk me through|give me|show me)\b/i,
  /\b(what|how|why|when|where|who|which) (is|are|was|were|do|does|did|can|could|would|should)\b/i,  // Question word + verb
]

// Clarification requests - SHOULD trigger LLM
const CLARIFY_PATTERNS = [
  /^(sorry|pardon|what do you mean|can you repeat|i didn't (catch|hear|understand))/i,
  /^(could you clarify|what was that|come again)/i,
]

// Acknowledgment - should NOT trigger LLM (only if entire utterance)
const ACKNOWLEDGE_PATTERNS = [
  /^(yes|yeah|yep|no|nope|sure|right|correct|exactly|got it|i see|understood|makes sense)[\s.,!?]*$/i,
  /^(thank you|thanks|great|good|perfect|awesome|okay|ok)[\s.,!?]*$/i,
]

// Statement patterns - user is making a declarative statement, not asking
// These should NOT trigger LLM - they're just stating facts or elaborating
const STATEMENT_PATTERNS = [
  // Starts with conjunction + subject + verb (continuation statements)
  /^(so|and|but|or)\s+\w+\s+(is|are|was|were|has|have|had|can|could|will|would|should|may|might)\b/i,
  
  // Starts with pronoun + verb (declarative statements)
  /^(it|this|that|they|these|those|he|she|we|i)\s+(is|are|was|were|has|have|had|can|could|will|would|should)\b/i,
  
  // Starts with "used for", "designed for", etc. (descriptive statements)
  /^(used for|primarily used|mainly used|designed for|built for|made for|intended for)\b/i,
  
  // Starts with conjunction + article (continuation)
  /^(and|but|or)\s+(the|a|an)\b/i,
  
  // Starts with verb participle (continuation of description)
  /^(using|running|working|building|creating|developing|implementing|providing|supporting|enabling)\b/i,
  
  // Common statement starters
  /^(java|javascript|python|typescript|react|node|the language|the framework|the library)\s+(is|are|was|were|has|have)\b/i,
]

// Minimum requirements
const MIN_WORDS_FOR_QUESTION = 3
const MIN_WORDS_FOR_EXPLAIN = 6  // Increased back to 6 to be more conservative
const MIN_CHARS = 10

export type ExtendedIntent = Intent | 'continue' | 'statement'

export function classifyIntent(text: string): ExtendedIntent {
  const trimmed = text.trim()
  const lowerText = trimmed.toLowerCase()
  const wordCount = trimmed.split(/\s+/).length
  
  // Too short - likely incomplete
  if (trimmed.length < MIN_CHARS || wordCount < 2) {
    return 'filler'
  }
  
  // Check questions FIRST (highest priority for questions)
  if (wordCount >= MIN_WORDS_FOR_QUESTION) {
    for (const pattern of QUESTION_PATTERNS) {
      if (pattern.test(trimmed)) return 'question'
    }
  }
  
  // Check clarification requests
  for (const pattern of CLARIFY_PATTERNS) {
    if (pattern.test(lowerText)) return 'clarify'
  }
  
  // Check STATEMENT patterns BEFORE continue patterns
  // This catches "So Java is..." type statements
  for (const pattern of STATEMENT_PATTERNS) {
    if (pattern.test(lowerText)) return 'statement'
  }
  
  // Check CONTINUE patterns (but not if it looks like a question)
  for (const pattern of CONTINUE_PATTERNS) {
    if (pattern.test(lowerText)) return 'continue'
  }
  
  // Check fillers (only exact matches)
  for (const pattern of FILLER_PATTERNS) {
    if (pattern.test(lowerText)) return 'filler'
  }
  
  // Check thinking patterns (only exact matches)
  for (const pattern of THINKING_PATTERNS) {
    if (pattern.test(lowerText)) return 'thinking'
  }
  
  // Check acknowledgments (only exact matches)
  for (const pattern of ACKNOWLEDGE_PATTERNS) {
    if (pattern.test(lowerText)) return 'acknowledge'
  }
  
  // Default: if it's long enough and looks like a request, treat as explanation request
  // BUT: Be VERY conservative - require explicit request language
  if (wordCount >= MIN_WORDS_FOR_EXPLAIN) {
    // Must have explicit request words - no more guessing
    const hasExplicitRequest = /\b(tell me|show me|explain|describe|help me|walk me through|give me|need to know|want to know|wondering|curious about|can you|could you|would you)\b/i.test(lowerText)
    const hasQuestionWord = /\b(what|how|why|when|where|who|which)\b/i.test(lowerText)
    
    if (hasExplicitRequest || hasQuestionWord) {
      return 'explain'
    }
  }
  
  // Default to 'statement' for anything else that's not clearly a question
  // This prevents false triggers on declarative statements
  return 'statement'
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
    case 'statement': reason = 'Declarative statement, not a question'; break
    case 'question': reason = 'Detected as question'; break
    case 'explain': reason = 'Request for explanation'; break
    case 'clarify': reason = 'Clarification request'; break
    case 'unknown': reason = 'Could not classify intent'; break
  }
  
  return { intent, shouldTrigger, shouldContinue, reason }
}
