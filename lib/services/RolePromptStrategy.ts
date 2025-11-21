/**
 * Role-based Prompt Strategy
 * Different AI prompts for interviewer vs applicant modes
 * Provides context-aware, role-specific assistance
 */

import { InterviewContext } from '../store'
import { UserRole } from './AIAnalysisService'

export interface PromptContext {
  conversationText: string
  language: string
  interviewContext?: InterviewContext
  role: UserRole
}

export class RolePromptStrategy {
  /**
   * Generate system prompt - ALWAYS for applicant assistance
   * Analyzes BOTH interviewer and applicant speech to help the applicant
   */
  getSystemPrompt(context: PromptContext): string {
    const { language, interviewContext, conversationText } = context

    const contextString = this.buildContextString(interviewContext)
    
    // Determine who spoke last to provide appropriate assistance
    const lines = conversationText.trim().split('\n')
    const lastLine = lines[lines.length - 1] || ''
    const isInterviewerSpeaking = lastLine.toLowerCase().includes('interviewer:')

    if (isInterviewerSpeaking) {
      // Interviewer just asked/said something → Provide answer
      return this.getAnswerPrompt(language, contextString)
    } else {
      // Applicant just said something → Provide feedback/improvement
      return this.getFeedbackPrompt(language, contextString)
    }
  }

  /**
   * Answer Prompt: When interviewer speaks, help applicant answer
   * OPTIMIZED: Concise prompt for faster AI response
   */
  private getAnswerPrompt(language: string, contextString: string): string {
    return `AI Interview Copilot - Help candidate answer interviewer's question.
Generate COMPLETE, READY-TO-USE ANSWER immediately.

Provide:
1. FULL ANSWER (professional, structured, natural)
2. Use STAR for behavioral (Situation→Task→Action→Result)
3. Bullet points for readability
4. **Bold** key points

Format ${language}
${contextString}

Return JSON ONLY:
{
  "answer": "COMPLETE ANSWER with bullets"
}

IGNORE: suggestions, hints, talkingPoints
BE FAST. Answer ONLY. Now.`
  }

  /**
   * Feedback Prompt: When applicant speaks, provide improvement suggestions
   * OPTIMIZED: Concise prompt for faster response
   */
  private getFeedbackPrompt(language: string, contextString: string): string {
    return `AI Copilot - Candidate just spoke. Provide FAST feedback based on what they did:

DETECT: ANSWERING | ASKING QUESTION | CLARIFYING

**ANSWERING**: Feedback + what to add + next steps
**ASKING**: Quality + improvements + follow-ups
**CLARIFYING**: Validate + better phrasing + what to clarify

Keep it BRIEF. Bullet points. **Bold** key points.

Language: ${language}
${contextString}

Return JSON ONLY:
{
  "answer": "FAST feedback/help"
}

IGNORE: suggestions, hints, talkingPoints
BE FAST. Answer ONLY. Now.`
  }

  /**
   * Build context string from interview context
   */
  private buildContextString(interviewContext?: InterviewContext): string {
    if (!interviewContext) return ''

    const contextParts: string[] = []

    if (interviewContext.jobRole) {
      contextParts.push(`Job Role: ${interviewContext.jobRole}`)
    }
    if (interviewContext.company) {
      contextParts.push(`Company: ${interviewContext.company}`)
    }
    if (interviewContext.skills?.length) {
      contextParts.push(`Key Skills: ${interviewContext.skills.join(', ')}`)
    }
    if (interviewContext.experience) {
      contextParts.push(`Experience: ${interviewContext.experience}`)
    }
    if (interviewContext.education) {
      contextParts.push(`Education: ${interviewContext.education}`)
    }
    if (interviewContext.achievements) {
      contextParts.push(`Achievements: ${interviewContext.achievements}`)
    }
    if (interviewContext.customNotes) {
      contextParts.push(`Additional Notes: ${interviewContext.customNotes}`)
    }

    return contextParts.length > 0
      ? `\n\nINTERVIEW CONTEXT:\n${contextParts.join('\n')}`
      : ''
  }
}

export const rolePromptStrategy = new RolePromptStrategy()

