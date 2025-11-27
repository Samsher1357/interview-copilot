import { Router, Request, Response } from 'express'
import multer from 'multer'
import pdfParse from 'pdf-parse'

const router = Router()

// Configure multer with file size limit (10MB) and file type validation
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Only PDF files are allowed'))
    }
  }
})

// Helper functions for basic extraction
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

// Parse resume text endpoint
router.post('/parse-resume', async (req: Request, res: Response) => {
  try {
    const { resumeText } = req.body

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' })
    }

    if (!resumeText || resumeText.trim().length === 0) {
      return res.status(400).json({ error: 'Resume text is required' })
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
      return res.status(response.status).json({ error: `OpenAI API error: ${response.statusText}` })
    }

    const data = await response.json() as any

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return res.status(500).json({ error: 'Invalid response from OpenAI' })
    }

    let parsedData
    try {
      parsedData = JSON.parse(data.choices[0].message.content)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', data.choices[0].message.content)
      return res.status(500).json({ error: 'Failed to parse resume data' })
    }

    const result = {
      jobRole: parsedData.jobRole || '',
      company: parsedData.company || '',
      skills: Array.isArray(parsedData.skills) ? parsedData.skills : [],
      experience: parsedData.experience || '',
      education: parsedData.education || '',
      achievements: parsedData.achievements || '',
      customNotes: parsedData.customNotes || '',
    }

    res.json(result)
  } catch (error: any) {
    console.error('Resume parsing error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

// Parse PDF endpoint with error handling
router.post('/parse-pdf', (req: Request, res: Response, next: Function) => {
  upload.single('file')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds 10MB limit' })
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` })
    } else if (err) {
      return res.status(400).json({ error: err.message })
    }
    next()
  })
}, async (req: Request, res: Response) => {
  try {
    const file = req.file

    if (!file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'File must be a PDF' })
    }

    const buffer = Buffer.from(file.buffer)
    const data = await pdfParse(buffer)
    const resumeText = data.text

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({
        error: 'Could not extract text from PDF. The PDF might be image-based or corrupted.',
      })
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' })
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
      return res.json({
        jobRole: '',
        company: '',
        skills: extractSkillsBasic(resumeText),
        experience: extractExperienceBasic(resumeText),
        education: extractEducationBasic(resumeText),
        achievements: '',
        customNotes: resumeText.substring(0, 500),
      })
    }

    const aiData = await response.json() as any

    if (!aiData.choices || !aiData.choices[0] || !aiData.choices[0].message) {
      return res.json({
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
      return res.json({
        jobRole: '',
        company: '',
        skills: extractSkillsBasic(resumeText),
        experience: extractExperienceBasic(resumeText),
        education: extractEducationBasic(resumeText),
        achievements: '',
        customNotes: resumeText.substring(0, 500),
      })
    }

    const result = {
      jobRole: parsedData.jobRole || '',
      company: parsedData.company || '',
      skills: Array.isArray(parsedData.skills) ? parsedData.skills : extractSkillsBasic(resumeText),
      experience: parsedData.experience || extractExperienceBasic(resumeText),
      education: parsedData.education || extractEducationBasic(resumeText),
      achievements: parsedData.achievements || '',
      customNotes: parsedData.customNotes || resumeText.substring(0, 500),
    }

    res.json(result)
  } catch (error: any) {
    console.error('PDF parsing error:', error)
    res.status(500).json({ error: error.message || 'Failed to parse PDF' })
  }
})

export { router as resumeRouter }

