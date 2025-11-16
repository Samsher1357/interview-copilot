import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse PDF - use dynamic import for Next.js compatibility
    const pdfParse = (await import('pdf-parse')).default as (buffer: Buffer) => Promise<{ text: string }>
    const data = await pdfParse(buffer)

    // Extract text
    const resumeText = data.text

    if (!resumeText || resumeText.trim().length < 50) {
      return NextResponse.json(
        { error: 'Could not extract text from PDF. The PDF might be image-based or corrupted.' },
        { status: 400 }
      )
    }

    // Use OpenAI to parse the extracted text
    const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const prompt = `Extract the following information from this resume text and return it as JSON:

Resume Text:
${resumeText.substring(0, 4000)} ${resumeText.length > 4000 ? '...' : ''}

Extract and return a JSON object with these fields:
- jobRole: Current or most recent job title/position
- company: Current or most recent company name
- skills: Array of technical skills, programming languages, tools, frameworks (extract as many as relevant)
- experience: Summary of work experience (years, key roles, industries)
- education: Educational background (degrees, universities, certifications)
- achievements: Notable achievements, awards, publications, projects
- customNotes: Any other relevant professional information

Return ONLY valid JSON, no additional text.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a resume parser. Extract structured information from resume text and return it as JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('OpenAI API error:', response.status, errorData)
      // Return basic extraction if API fails
      return NextResponse.json({
        jobRole: '',
        company: '',
        skills: extractSkillsBasic(resumeText),
        experience: extractExperienceBasic(resumeText),
        education: extractEducationBasic(resumeText),
        achievements: '',
        customNotes: resumeText.substring(0, 500),
      })
    }

    const aiData = await response.json()

    if (!aiData.choices || !aiData.choices[0] || !aiData.choices[0].message) {
      return NextResponse.json({
        jobRole: '',
        company: '',
        skills: extractSkillsBasic(resumeText),
        experience: extractExperienceBasic(resumeText),
        education: extractEducationBasic(resumeText),
        achievements: '',
        customNotes: resumeText.substring(0, 500),
      })
    }

    let parsedData
    try {
      parsedData = JSON.parse(aiData.choices[0].message.content)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', aiData.choices[0].message.content)
      return NextResponse.json({
        jobRole: '',
        company: '',
        skills: extractSkillsBasic(resumeText),
        experience: extractExperienceBasic(resumeText),
        education: extractEducationBasic(resumeText),
        achievements: '',
        customNotes: resumeText.substring(0, 500),
      })
    }

    // Clean and validate the data
    const result = {
      jobRole: parsedData.jobRole || '',
      company: parsedData.company || '',
      skills: Array.isArray(parsedData.skills) ? parsedData.skills : extractSkillsBasic(resumeText),
      experience: parsedData.experience || extractExperienceBasic(resumeText),
      education: parsedData.education || extractEducationBasic(resumeText),
      achievements: parsedData.achievements || '',
      customNotes: parsedData.customNotes || resumeText.substring(0, 500),
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('PDF parsing error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to parse PDF' },
      { status: 500 }
    )
  }
}

function extractSkillsBasic(text: string): string[] {
  const skillsPattern = /(?:skills?|technologies?|proficiency|expertise)[:\s]+([^.\n]+)/i
  const skillsMatch = text.match(skillsPattern)
  if (skillsMatch) {
    return skillsMatch[1]
      .split(/[,;|]/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .slice(0, 20)
  }
  return []
}

function extractExperienceBasic(text: string): string {
  const experiencePattern = /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i
  const experienceMatch = text.match(experiencePattern)
  if (experienceMatch) {
    return `${experienceMatch[1]} years of experience`
  }
  return ''
}

function extractEducationBasic(text: string): string {
  const educationPattern = /(?:education|degree|university|college)[:\s]+([^.\n]+)/i
  const educationMatch = text.match(educationPattern)
  if (educationMatch) {
    return educationMatch[1].trim()
  }
  return ''
}

