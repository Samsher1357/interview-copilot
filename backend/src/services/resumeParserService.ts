import '../config/env'
import { buildResumeParsingPrompt } from '../ai/promptBuilder'

export interface ResumeData {
  jobRole: string
  company: string
  skills: string[]
  experience: string
  education: string
  achievements: string
  customNotes: string
}

/**
 * Resume Parser Service
 * Centralized service for parsing resume text using OpenAI
 */
export class ResumeParserService {
  private readonly apiKey: string
  private readonly model = 'gpt-4o-mini'
  private readonly maxTokens = 1000
  private readonly temperature = 0.3

  constructor() {
    const key = process.env.OPENAI_API_KEY
    if (!key) {
      throw new Error('OpenAI API key not configured')
    }
    this.apiKey = key
  }

  /**
   * Parse resume text and extract structured information
   */
  async parseResumeText(resumeText: string): Promise<ResumeData> {
    if (!resumeText || resumeText.trim().length === 0) {
      throw new Error('Resume text is required')
    }

    const prompt = this.buildPrompt(resumeText)

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a resume parser. Extract structured information from resume text and return it as JSON only.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          response_format: { type: 'json_object' },
        }),
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('OpenAI API error:', response.status, errorData)
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }

      const data = await response.json() as any

      if (!data.choices?.[0]?.message) {
        throw new Error('Invalid response from OpenAI')
      }

      return this.parseOpenAIResponse(data.choices[0].message.content)
    } catch (error) {
      console.error('Resume parsing error:', error)
      throw error
    }
  }

  /**
   * Parse resume text with fallback to basic extraction
   */
  async parseResumeTextWithFallback(resumeText: string): Promise<ResumeData> {
    try {
      return await this.parseResumeText(resumeText)
    } catch (error) {
      console.warn('AI parsing failed, using basic extraction:', error)
      return this.extractBasicInfo(resumeText)
    }
  }

  /**
   * Build the prompt for OpenAI
   */
  private buildPrompt(resumeText: string): string {
    return buildResumeParsingPrompt(resumeText)
  }

  /**
   * Parse OpenAI response and validate structure
   */
  private parseOpenAIResponse(content: string): ResumeData {
    try {
      const parsedData = JSON.parse(content)
      
      return {
        jobRole: parsedData.jobRole || '',
        company: parsedData.company || '',
        skills: Array.isArray(parsedData.skills) ? parsedData.skills : [],
        experience: parsedData.experience || '',
        education: parsedData.education || '',
        achievements: parsedData.achievements || '',
        customNotes: parsedData.customNotes || '',
      }
    } catch (error) {
      console.error('Failed to parse OpenAI response:', error)
      throw new Error('Failed to parse resume data')
    }
  }

  /**
   * Basic extraction fallback when AI parsing fails
   */
  private extractBasicInfo(text: string): ResumeData {
    return {
      jobRole: '',
      company: '',
      skills: this.extractSkillsBasic(text),
      experience: this.extractExperienceBasic(text),
      education: this.extractEducationBasic(text),
      achievements: '',
      customNotes: text.substring(0, 500),
    }
  }

  private extractSkillsBasic(text: string): string[] {
    const skillsPattern = /(?:skills?|technologies?|proficiency|expertise)[:\s]+([^.\n]+)/i
    const skillsMatch = skillsPattern.exec(text)
    if (skillsMatch) {
      return skillsMatch[1]
        .split(/[,;|]/)
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .slice(0, 20)
    }
    return []
  }

  private extractExperienceBasic(text: string): string {
    const experiencePattern = /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i
    const experienceMatch = experiencePattern.exec(text)
    if (experienceMatch) {
      return `${experienceMatch[1]} years of experience`
    }
    return ''
  }

  private extractEducationBasic(text: string): string {
    const educationPattern = /(?:education|degree|university|college)[:\s]+([^.\n]+)/i
    const educationMatch = educationPattern.exec(text)
    if (educationMatch) {
      return educationMatch[1].trim()
    }
    return ''
  }
}

// Singleton instance
export const resumeParserService = new ResumeParserService()
