/**
 * Enhanced Speaker Detection Service
 * Uses multiple heuristics and context to accurately identify speakers
 */

export interface SpeakerDetectionResult {
  speaker: 'interviewer' | 'applicant'
  confidence: number
  reason: string
}

export class SpeakerDetectionService {
  private conversationHistory: Array<{ speaker: 'interviewer' | 'applicant'; text: string }> = []
  private readonly maxHistoryLength = 10

  // Question patterns (interviewer indicators)
  private questionPatterns = [
    /\b(what|why|how|when|where|who|which|whose|whom)\b/i,
    /\b(tell me|describe|explain|can you|could you|would you|do you|did you|have you|are you|is there)\b/i,
    /\b(walk me through|give me an example|talk about|share with me)\b/i,
    /\b(what's|what is|what are|how's|how is|how are)\b/i,
  ]

  // Answer patterns (applicant indicators)
  private answerPatterns = [
    /\b(i think|i believe|i would|i have|i've|i'm|i am|in my|from my|my experience|i worked|i did)\b/i,
    /\b(thank you|thanks|that's|that is|yes|yeah|sure|absolutely|definitely)\b/i,
    /\b(well|so|basically|essentially|to be honest|frankly)\b/i,
  ]

  // Interviewer-specific phrases
  private interviewerPhrases = [
    'tell me about yourself',
    'why do you want',
    'what are your strengths',
    'what are your weaknesses',
    'where do you see yourself',
    'why should we hire',
    'do you have any questions',
    'what questions do you have',
    'tell me about a time',
    'describe a situation',
    'give me an example',
  ]

  // Applicant-specific phrases
  private applicantPhrases = [
    'i have experience',
    'i worked on',
    'i was responsible',
    'my role was',
    'i helped',
    'i contributed',
    'i learned',
    'i developed',
    'i implemented',
  ]

  detectSpeaker(
    text: string,
    previousSpeaker: 'interviewer' | 'applicant',
    confidence?: number
  ): SpeakerDetectionResult {
    const lowerText = text.toLowerCase().trim()
    const textLength = text.length

    // Skip very short utterances (likely noise or incomplete)
    if (textLength < 3) {
      return {
        speaker: previousSpeaker,
        confidence: 0.3,
        reason: 'Text too short, using previous speaker',
      }
    }

    let interviewerScore = 0
    let applicantScore = 0
    const reasons: string[] = []

    // Check for question mark (strong interviewer indicator)
    if (text.includes('?')) {
      interviewerScore += 3
      reasons.push('Contains question mark')
    }

    // Check question patterns
    const hasQuestionPattern = this.questionPatterns.some((pattern) => pattern.test(text))
    if (hasQuestionPattern) {
      interviewerScore += 2
      reasons.push('Contains question pattern')
    }

    // Check for interviewer-specific phrases
    const hasInterviewerPhrase = this.interviewerPhrases.some((phrase) =>
      lowerText.includes(phrase)
    )
    if (hasInterviewerPhrase) {
      interviewerScore += 2.5
      reasons.push('Contains interviewer phrase')
    }

    // Check answer patterns
    const hasAnswerPattern = this.answerPatterns.some((pattern) => pattern.test(text))
    if (hasAnswerPattern) {
      applicantScore += 2
      reasons.push('Contains answer pattern')
    }

    // Check for applicant-specific phrases
    const hasApplicantPhrase = this.applicantPhrases.some((phrase) => lowerText.includes(phrase))
    if (hasApplicantPhrase) {
      applicantScore += 2.5
      reasons.push('Contains applicant phrase')
    }

    // Check sentence structure
    // Questions typically start with question words
    const firstWord = lowerText.split(/\s+/)[0]
    if (['what', 'why', 'how', 'when', 'where', 'who', 'which', 'tell', 'describe', 'explain'].includes(firstWord)) {
      interviewerScore += 1.5
      reasons.push('Starts with question word')
    }

    // Check for first-person pronouns (applicant indicator)
    const firstPersonCount = (lowerText.match(/\b(i|me|my|myself|we|us|our)\b/g) || []).length
    if (firstPersonCount > 2) {
      applicantScore += 1.5
      reasons.push('High first-person pronoun usage')
    }

    // Check conversation history for context
    if (this.conversationHistory.length > 0) {
      const lastSpeaker = this.conversationHistory[this.conversationHistory.length - 1].speaker
      
      // If last speaker was interviewer, next is likely applicant (and vice versa)
      if (lastSpeaker === 'interviewer') {
        applicantScore += 1
        reasons.push('Context: last speaker was interviewer')
      } else {
        interviewerScore += 1
        reasons.push('Context: last speaker was applicant')
      }
    }

    // Use confidence from recognition if available
    if (confidence !== undefined) {
      if (confidence > 0.8) {
        // High confidence strengthens the detected speaker
        if (interviewerScore > applicantScore) {
          interviewerScore += 0.5
        } else if (applicantScore > interviewerScore) {
          applicantScore += 0.5
        }
      } else if (confidence < 0.5) {
        // Low confidence - rely more on previous speaker
        if (previousSpeaker === 'interviewer') {
          interviewerScore += 1
        } else {
          applicantScore += 1
        }
      }
    }

    // Determine speaker
    let detectedSpeaker: 'interviewer' | 'applicant'
    let finalConfidence: number

    if (interviewerScore > applicantScore) {
      detectedSpeaker = 'interviewer'
      finalConfidence = Math.min(0.95, 0.5 + (interviewerScore / 10))
    } else if (applicantScore > interviewerScore) {
      detectedSpeaker = 'applicant'
      finalConfidence = Math.min(0.95, 0.5 + (applicantScore / 10))
    } else {
      // Tie - use alternation pattern
      detectedSpeaker = previousSpeaker === 'interviewer' ? 'applicant' : 'interviewer'
      finalConfidence = 0.6
      reasons.push('Tie score, using alternation pattern')
    }

    // Update conversation history
    this.addToHistory(detectedSpeaker, text)

    return {
      speaker: detectedSpeaker,
      confidence: finalConfidence,
      reason: reasons.join(', ') || 'Default alternation',
    }
  }

  private addToHistory(speaker: 'interviewer' | 'applicant', text: string) {
    this.conversationHistory.push({ speaker, text })
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory.shift()
    }
  }

  resetHistory() {
    this.conversationHistory = []
  }

  getHistory(): Array<{ speaker: 'interviewer' | 'applicant'; text: string }> {
    return [...this.conversationHistory]
  }
}

export const speakerDetectionService = new SpeakerDetectionService()

