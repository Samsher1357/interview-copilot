import { InterviewContext, Turn } from '../types'

export interface PromptOptions {
  language: string
  simpleEnglish?: boolean
  context?: InterviewContext
  turns?: Turn[]
  utteranceText: string
}

export function buildSystemPrompt(options: PromptOptions): string {
  const { language, simpleEnglish = false, context, turns = [], utteranceText } = options

  const turnHistory = formatTurns(turns)
  const contextSection = buildContextSection(context)

  return `You are a real-time interview copilot. Give concise, structured help. Do not repeat the question. Wait for complete user turns.

RULES:
- Respond ONLY to complete thoughts
- Be concise and interview-ready
- Use bullet points (•) for structure
- Use ==text== to highlight KEY TERMS
- Use **text** for emphasis
- 3-5 bullets max
- No emojis except 💬 and ⭐
- No markdown headings
- No JSON
${simpleEnglish ? '- Use simple English, short sentences' : '- Use professional interview language'}

OUTPUT FORMAT:
💬 Question:
[Clear version of the interviewer's question]

⭐ Answer:
• [Point 1]
• [Point 2]
• [Point 3]

CANDIDATE CONTEXT:
${contextSection}

CONVERSATION (last ${turns.length} turns):
${turnHistory || 'No prior conversation'}

LATEST USER INPUT:
"${utteranceText}"

Respond now with a structured interview answer.`.trim()
}

function formatTurns(turns: Turn[]): string {
  if (!turns.length) return ''
  
  return turns
    .slice(-6)
    .map(t => `${t.speaker === 'user' ? 'USER' : 'AI'}: ${t.content}`)
    .join('\n')
}

function buildContextSection(context?: InterviewContext): string {
  if (!context) return 'N/A'

  const parts: string[] = []
  if (context.jobRole) parts.push(`Role: ${context.jobRole}`)
  if (context.company) parts.push(`Company: ${context.company}`)
  if (context.skills?.length) parts.push(`Skills: ${context.skills.join(', ')}`)
  if (context.experience) parts.push(`Experience: ${context.experience}`)
  if (context.education) parts.push(`Education: ${context.education}`)
  if (context.achievements) parts.push(`Achievements: ${context.achievements}`)
  if (context.customNotes) parts.push(`Notes: ${context.customNotes}`)

  return parts.length ? parts.join('\n') : 'N/A'
}

export function buildResumeParsingPrompt(resumeText: string): string {
  const MAX_CHARS = 4000
  const truncated = resumeText.slice(0, MAX_CHARS)
  const suffix = resumeText.length > MAX_CHARS ? '\n...[truncated]' : ''

  return `Extract structured information from this resume.

RESUME:
${truncated}${suffix}

Return ONLY valid JSON:
{
  "jobRole": string | null,
  "company": string | null,
  "skills": string[],
  "experience": string | null,
  "education": string | null,
  "achievements": string | null,
  "customNotes": string | null
}

Rules:
- Do NOT infer facts not present
- Use null if missing
- No extra text`.trim()
}
