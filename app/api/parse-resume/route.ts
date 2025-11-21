import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { resumeText } = await request.json()

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    if (!resumeText || resumeText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Resume text is required' },
        { status: 400 }
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
      return NextResponse.json(
        { error: `OpenAI API error: ${response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return NextResponse.json(
        { error: 'Invalid response from OpenAI' },
        { status: 500 }
      )
    }

    let parsedData
    try {
      parsedData = JSON.parse(data.choices[0].message.content)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', data.choices[0].message.content)
      return NextResponse.json(
        { error: 'Failed to parse resume data' },
        { status: 500 }
      )
    }

    // Clean and validate the data
    const result = {
      jobRole: parsedData.jobRole || '',
      company: parsedData.company || '',
      skills: Array.isArray(parsedData.skills) ? parsedData.skills : [],
      experience: parsedData.experience || '',
      education: parsedData.education || '',
      achievements: parsedData.achievements || '',
      customNotes: parsedData.customNotes || '',
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Resume parsing error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

