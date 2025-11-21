// Resume parser utility - extracts information from resume text using AI

export interface ParsedResume {
  jobRole?: string
  company?: string
  skills?: string[]
  experience?: string
  education?: string
  achievements?: string
  customNotes?: string
}

export async function parseResumeText(resumeText: string): Promise<ParsedResume> {
  // This function calls the API route, so no API key needed here

  try {
    const response = await fetch('/api/parse-resume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ resumeText }),
    })

    if (!response.ok) {
      throw new Error('Failed to parse resume')
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Resume parsing error:', error)
    // Fallback: try to extract basic info using regex
    return extractBasicInfo(resumeText)
  }
}

function extractBasicInfo(text: string): ParsedResume {
  const result: ParsedResume = {}

  // Extract skills (common patterns)
  const skillsPattern = /(?:skills?|technologies?|proficiency)[:\s]+([^.\n]+)/i
  const skillsMatch = text.match(skillsPattern)
  if (skillsMatch) {
    result.skills = skillsMatch[1]
      .split(/[,;|]/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .slice(0, 20) // Limit to 20 skills
  }

  // Extract education
  const educationPattern = /(?:education|degree|university|college)[:\s]+([^.\n]+)/i
  const educationMatch = text.match(educationPattern)
  if (educationMatch) {
    result.education = educationMatch[1].trim()
  }

  // Extract experience (years)
  const experiencePattern = /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i
  const experienceMatch = text.match(experiencePattern)
  if (experienceMatch) {
    result.experience = `${experienceMatch[1]} years of experience`
  }

  return result
}

