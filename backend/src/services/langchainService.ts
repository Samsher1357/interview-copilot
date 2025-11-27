import '../config/env' // Load environment variables first
import { ChatOpenAI } from '@langchain/openai'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { TranscriptEntry, AIResponse } from '../types'

interface AnalysisResult {
  intent: string
  context: string
  answer: string
  suggestions: string[]
  hints: string[]
  talkingPoints: string[]
}

export class LangChainService {
  private llm: BaseChatModel
  private conversationHistory: TranscriptEntry[] = []
  private readonly maxHistoryLength = 20
  private provider: 'openai' | 'gemini'

  constructor() {
    const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase()
    this.provider = provider as 'openai' | 'gemini'

    const maxTokens = parseInt(process.env.AI_MAX_TOKENS || '800') // Reduced for faster response

    if (this.provider === 'gemini') {
      const apiKey = process.env.GOOGLE_API_KEY

      if (!apiKey) {
        throw new Error('Google API key not configured. Get one at https://makersuite.google.com/app/apikey')
      }

      const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash'

      console.log(`🤖 Using Google Gemini model: ${modelName} with max ${maxTokens} tokens`)

      this.llm = new ChatGoogleGenerativeAI({
        model: modelName,
        temperature: 0.7,
        maxOutputTokens: maxTokens,
        apiKey,
        streaming: true,
      })
    } else {
      const apiKey = process.env.OPENAI_API_KEY

      if (!apiKey) {
        throw new Error('OpenAI API key not configured')
      }

      const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini'

      console.log(`🤖 Using OpenAI model: ${modelName} with max ${maxTokens} tokens`)

      this.llm = new ChatOpenAI({
        modelName,
        temperature: 0.7,
        maxTokens,
        openAIApiKey: apiKey,
        streaming: true,
        timeout: 30000,
      })
    }
  }

  async analyzeConversation(
    transcripts: TranscriptEntry[],
    language: string = 'en',
    interviewContext?: any,
    onToken?: (token: string) => void
  ): Promise<AIResponse[]> {
    this.conversationHistory = transcripts.slice(-this.maxHistoryLength)

    const latestEntry = transcripts[transcripts.length - 1]
    if (!latestEntry) {
      return []
    }

    // Only analyze when interviewer speaks (applicant gets answers)
    if (latestEntry.speaker !== 'interviewer') {
      return []
    }

    try {
      const analysis = await this.getAIAnalysis(transcripts, language, interviewContext, onToken)
      const responses: AIResponse[] = []

      if (analysis.answer && analysis.answer.trim()) {
        responses.push({
          id: `answer-${Date.now()}`,
          type: 'answer',
          content: analysis.answer,
          timestamp: Date.now(),
          confidence: 0.9,
        })
      }

      return responses
    } catch (error) {
      console.error('AI analysis error:', error)
      const fallbackAnswer = latestEntry.speaker === 'interviewer'
        ? "I appreciate that question. Based on my experience and background, I would approach this by focusing on the key aspects that are most relevant to the role and demonstrating how my skills align with what you're looking for."
        : ''

      if (fallbackAnswer) {
        return [{
          id: `answer-fallback-${Date.now()}`,
          type: 'answer',
          content: fallbackAnswer,
          timestamp: Date.now(),
          confidence: 0.5,
        }]
      }
      return []
    }
  }

  async *streamAnalysis(
    transcripts: TranscriptEntry[],
    language: string = 'en',
    interviewContext?: any,
    simpleEnglish: boolean = false
  ): AsyncGenerator<string, void, unknown> {
    const latestEntry = transcripts[transcripts.length - 1]
    if (!latestEntry || latestEntry.speaker !== 'interviewer') {
      return
    }

    try {
      const conversationText = transcripts
        .map((t) => `${t.speaker === 'interviewer' ? 'Interviewer' : 'You'}: ${t.text}`)
        .join('\n')

      const contextParts: string[] = []
      if (interviewContext?.jobRole) {
        contextParts.push(`Job Role: ${interviewContext.jobRole}`)
      }
      if (interviewContext?.company) {
        contextParts.push(`Company: ${interviewContext.company}`)
      }
      if (interviewContext?.skills?.length > 0) {
        contextParts.push(`Key Skills: ${interviewContext.skills.join(', ')}`)
      }
      if (interviewContext?.experience) {
        contextParts.push(`Experience: ${interviewContext.experience}`)
      }
      if (interviewContext?.education) {
        contextParts.push(`Education: ${interviewContext.education}`)
      }
      if (interviewContext?.achievements) {
        contextParts.push(`Achievements: ${interviewContext.achievements}`)
      }
      if (interviewContext?.customNotes) {
        contextParts.push(`Additional Notes: ${interviewContext.customNotes}`)
      }

      const contextString = contextParts.length > 0
        ? `\n\nCANDIDATE CONTEXT (Use this to personalize answers):\n${contextParts.join('\n')}`
        : ''

      const languageGuideline = simpleEnglish
        ? `- Use SIMPLE ENGLISH: short common words, clear sentences, avoid complex terms
- Explain technical concepts using everyday language
- Perfect for non-native English speakers
- Keep vocabulary basic but professional`
        : `- Use conversational tone naturally integrated into flowing sentences
- Include 4-8 important **technical keywords** naturally within the response`

      const latestQuestion = latestEntry.text
      
      const systemPrompt = `You are an AI Interview Copilot helping a job candidate during a live interview. 
Your PRIMARY role is to generate COMPLETE, READY-TO-USE ANSWERS to the interviewer's questions.

When the interviewer asks a question, you MUST provide a direct answer:
1. A FULL ANSWER that the candidate can use directly or adapt
2. Professional, well-structured, and appropriate for an interview
3. Natural and conversational, not robotic
4. Include relevant examples, experiences, or talking points when appropriate
5. PERSONALIZE answers using the candidate's context (job role, skills, experience) when relevant

Answer Guidelines:
- Keep responses under 130 words for quick reading
${languageGuideline}
- For technical questions, weave expertise into natural speech patterns
- For behavioral questions, tell brief stories that flow naturally
- Make it sound authentic, like the candidate speaking in real-time

Language: ${language || 'en'}
${contextString}

Previous conversation context:
${conversationText}

MOST RECENT QUESTION FROM INTERVIEWER: "${latestQuestion}"

CRITICAL: Answer ONLY the most recent question above. Return ONLY the answer text directly. No JSON, no labels, no extra formatting. Just the natural, conversational answer that flows like real speech.`

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Answer this specific question: "${latestQuestion}"\n\nProvide a direct answer that the applicant can use. Return ONLY the answer text, no JSON structure.`),
      ]

      const stream = await this.llm.stream(messages)

      let fullResponse = ''
      let buffer = ''
      for await (const chunk of stream) {
        const content = chunk.content
        if (typeof content === 'string' && content) {
          fullResponse += content
          buffer += content
          
          // Yield in small batches for smoother streaming
          if (buffer.length >= 3 || /[\s.!?,]/.test(content)) {
            yield buffer
            buffer = ''
          }
        }
      }
      
      // Yield any remaining content
      if (buffer) {
        yield buffer
      }
    } catch (error) {
      console.error('Streaming error:', error)

      if (error instanceof Error) {
        if (error.message.includes('Rate limit') || error.message.includes('429')) {
          const retryMatch = error.message.match(/Please try again in ([^.]+)/)
          const retryTime = retryMatch ? retryMatch[1] : 'a few minutes'
          throw new Error(`OpenAI rate limit reached. Please wait ${retryTime} or use a different model. Set OPENAI_MODEL=gpt-3.5-turbo or upgrade your OpenAI plan.`)
        }
        if (error.message.includes('quota')) {
          throw new Error('OpenAI quota exceeded. Please check your billing at https://platform.openai.com/account/billing')
        }
      }

      throw error
    }
  }

  private async getAIAnalysis(
    transcripts: TranscriptEntry[],
    language: string,
    interviewContext?: any,
    onToken?: (token: string) => void
  ): Promise<AnalysisResult> {
    try {
      const conversationText = transcripts
        .map((t) => `${t.speaker === 'interviewer' ? 'Interviewer' : 'You'}: ${t.text}`)
        .join('\n')

      const contextParts: string[] = []
      if (interviewContext?.jobRole) {
        contextParts.push(`Job Role: ${interviewContext.jobRole}`)
      }
      if (interviewContext?.company) {
        contextParts.push(`Company: ${interviewContext.company}`)
      }
      if (interviewContext?.skills?.length > 0) {
        contextParts.push(`Key Skills: ${interviewContext.skills.join(', ')}`)
      }
      if (interviewContext?.experience) {
        contextParts.push(`Experience: ${interviewContext.experience}`)
      }
      if (interviewContext?.education) {
        contextParts.push(`Education: ${interviewContext.education}`)
      }
      if (interviewContext?.achievements) {
        contextParts.push(`Achievements: ${interviewContext.achievements}`)
      }
      if (interviewContext?.customNotes) {
        contextParts.push(`Additional Notes: ${interviewContext.customNotes}`)
      }

      const contextString = contextParts.length > 0
        ? `\n\nCANDIDATE CONTEXT (Use this to personalize answers):\n${contextParts.join('\n')}`
        : ''

      const latestEntry = transcripts[transcripts.length - 1]
      const latestQuestion = latestEntry?.text || ''

      const systemPrompt = `You are an AI Interview Copilot helping a job candidate during a live interview. 
Your PRIMARY role is to generate COMPLETE, READY-TO-USE ANSWERS to the interviewer's questions.

When the interviewer asks a question, you MUST provide:
1. A FULL ANSWER that the candidate can use directly or adapt
2. The answer should be professional, well-structured, and appropriate for an interview
3. Make it sound natural and conversational, not robotic
4. Include relevant examples, experiences, or talking points when appropriate
5. PERSONALIZE answers using the candidate's context (job role, skills, experience) when relevant

Answer Guidelines:
- ALWAYS format answers using bullet points for maximum readability
- Structure answers clearly (use STAR method for behavioral questions: Situation, Task, Action, Result)
- For technical questions, provide accurate, detailed explanations in bullet format and reference the candidate's relevant skills
- For behavioral questions, include specific examples in bullet points that align with the candidate's experience
- For role-specific questions, demonstrate knowledge and enthusiasm about the role/company using structured bullet points
- Make answers sound natural and authentic, as if the candidate is speaking
- Highlight key points using **bold** or ==highlight== syntax

Answer Formatting (CRITICAL - ALWAYS FOLLOW):
- ALWAYS use bullet points (- or •) for main points
- Use sub-bullets for details (indent with spaces or -)
- Use **bold** to highlight important keywords, skills, or achievements
- Use ==highlight== for critical points that must stand out
- Structure with clear sections separated by line breaks
- Keep each bullet point concise (1-2 sentences max)
- Start with a brief intro sentence, then use bullets for details

Also provide:
- Additional suggestions for how to enhance the answer
- Key talking points to emphasize
- Subtle hints if the candidate needs to adjust their approach

Language: ${language || 'en'}
${contextString}

Previous conversation context:
${conversationText}

MOST RECENT QUESTION FROM INTERVIEWER: "${latestQuestion}"

CRITICAL: Answer ONLY the most recent question above. Provide a COMPLETE ANSWER for this specific question.

Provide analysis in JSON format with:
- intent: detected interviewer intent (e.g., "technical", "behavioral", "cultural-fit", "role-specific")
- context: brief context summary
- answer: A COMPLETE, READY-TO-USE ANSWER to the MOST RECENT question (this is the most important field)
- suggestions: array of 1-2 additional suggestions or enhancements
- hints: array of 1-2 subtle hints
- talkingPoints: array of 1-2 key points to emphasize`

      const messages = [
        new SystemMessage(systemPrompt + '\n\nIMPORTANT: You MUST return ONLY valid JSON. Do not include any markdown code blocks, explanations, or additional text. Return a JSON object with the exact structure: {"intent": "...", "context": "...", "answer": "...", "suggestions": [...], "hints": [...], "talkingPoints": [...]}'),
        new HumanMessage(`Answer this specific question: "${latestQuestion}"\n\nProvide a complete answer in the "answer" field. Return ONLY valid JSON with no additional text.`),
      ]

      let fullResponse = ''

      if (onToken) {
        const stream = await this.llm.stream(messages)
        for await (const chunk of stream) {
          const content = chunk.content
          if (typeof content === 'string' && content) {
            fullResponse += content
            onToken(content)
          }
        }
      } else {
        const response = await this.llm.invoke(messages)
        fullResponse = response.content as string
      }

      let content: AnalysisResult
      try {
        const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
          fullResponse.match(/```\s*([\s\S]*?)\s*```/) ||
          [null, fullResponse]
        const jsonString = jsonMatch[1] || fullResponse
        content = JSON.parse(jsonString)
      } catch (parseError) {
        console.error('Failed to parse AI response:', fullResponse)
        const latestQuestion = transcripts[transcripts.length - 1]?.text || ''
        const isQuestion = latestQuestion.includes('?') ||
          ['what', 'why', 'how', 'when', 'where', 'who', 'tell me', 'describe', 'explain']
            .some(word => latestQuestion.toLowerCase().includes(word))

        return {
          intent: 'general',
          context: 'Fallback response due to parsing error',
          answer: isQuestion
            ? "I appreciate that question. Based on my experience and background, I would approach this by focusing on the key aspects that are most relevant to the role and demonstrating how my skills and experience align with what you're looking for."
            : '',
          suggestions: ['Ensure your answer is clear and concise'],
          hints: ['Focus on your relevant experience'],
          talkingPoints: ['Highlight your strengths and achievements'],
        }
      }

      return {
        intent: content.intent || 'general',
        context: content.context || '',
        answer: content.answer || '',
        suggestions: Array.isArray(content.suggestions) ? content.suggestions : [],
        hints: Array.isArray(content.hints) ? content.hints : [],
        talkingPoints: Array.isArray(content.talkingPoints) ? content.talkingPoints : [],
      }
    } catch (error: any) {
      console.error('API call failed:', error)

      const latestQuestion = transcripts[transcripts.length - 1]?.text || ''
      const isQuestion = latestQuestion.includes('?') ||
        ['what', 'why', 'how', 'when', 'where', 'who', 'tell me', 'describe', 'explain']
          .some(word => latestQuestion.toLowerCase().includes(word))

      return {
        intent: 'general',
        context: 'Fallback response due to API error',
        answer: isQuestion
          ? "I appreciate that question. Based on my experience and background, I would approach this by focusing on the key aspects that are most relevant to the role and demonstrating how my skills and experience align with what you're looking for."
          : '',
        suggestions: ['Ensure your answer is clear and concise'],
        hints: ['Focus on your relevant experience'],
        talkingPoints: ['Highlight your strengths and achievements'],
      }
    }
  }

  detectSpeaker(text: string, previousSpeaker: 'interviewer' | 'applicant'): 'interviewer' | 'applicant' {
    const questionWords = ['what', 'why', 'how', 'when', 'where', 'who', 'tell me', 'describe', 'explain']
    const lowerText = text.toLowerCase()

    if (questionWords.some(word => lowerText.includes(word)) && lowerText.includes('?')) {
      return 'interviewer'
    }

    return previousSpeaker === 'interviewer' ? 'applicant' : 'interviewer'
  }
}

export const langchainService = new LangChainService()

