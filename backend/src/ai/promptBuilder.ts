import { InterviewContext } from '../types'

/**
 * AI Prompt Builder Utilities
 * Centralized prompt construction for consistency
 */

export interface PromptOptions {
  language: string
  simpleEnglish?: boolean
  context?: InterviewContext
  conversationHistory?: string
  question: string
}

/**
 * Build system prompt for interview copilot
 */
export function buildInterviewSystemPrompt(options: PromptOptions): string {
  const { language, simpleEnglish, context, conversationHistory, question } = options

  const contextSection = context ? buildContextSection(context) : ''
  const conversationSection = conversationHistory
    ? `\nConversation:\n${conversationHistory}\n`
    : ''

  return `
You are an AI Interview Copilot.

OBJECTIVE:
Give a COMPLETE, READY-TO-USE interview answer.

Rules:
- Answer ALL parts of the question
- Be professional, natural, and confident
- Personalize using candidate context
- If multi-part, address each explicitly
${simpleEnglish ? '- Use simple English, short sentences' : ''}

Language: ${language}
${contextSection}
${conversationSection}
Latest question:
"${question}"

Return ONLY the answer text. No JSON. No labels.
`.trim()
}

/**
 * Build context section from interview context
 */
function buildContextSection(context: InterviewContext): string {
  const parts: string[] = []

  if (context.jobRole) parts.push(`Job Role: ${context.jobRole}`)
  if (context.company) parts.push(`Company: ${context.company}`)
  if (context.skills?.length) parts.push(`Skills: ${context.skills.join(', ')}`)
  if (context.experience) parts.push(`Experience: ${context.experience}`)
  if (context.education) parts.push(`Education: ${context.education}`)
  if (context.achievements) parts.push(`Achievements: ${context.achievements}`)
  if (context.customNotes) parts.push(`Notes: ${context.customNotes}`)

  return parts.length ? `\nCandidate Context:\n${parts.join('\n')}` : ''
}

/**
 * Build resume parsing prompt
 */
export function buildResumeParsingPrompt(resumeText: string): string {
  const truncatedText = resumeText.substring(0, 4000)
  const ellipsis = resumeText.length > 4000 ? '...' : ''

  return `Extract the following information from this resume text and return it as JSON:

Resume Text:
${truncatedText}${ellipsis}

Extract and return a JSON object with these fields:
- jobRole: Current or most recent job title/position
- company: Current or most recent company name
- skills: Array of technical skills, programming languages, tools, frameworks (extract as many as relevant)
- experience: Summary of work experience (years, key roles, industries)
- education: Educational background (degrees, universities, certifications)
- achievements: Notable achievements, awards, publications, projects
- customNotes: Any other relevant professional information

Return ONLY valid JSON, no additional text.`
}
