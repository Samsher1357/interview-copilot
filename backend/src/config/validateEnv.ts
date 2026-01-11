/**
 * Simple environment variable validation
 */

export function validateEnvironment(): void {
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  const hasGemini = !!process.env.GOOGLE_API_KEY

  if (!hasOpenAI && !hasGemini) {
    console.error('❌ Error: OPENAI_API_KEY or GOOGLE_API_KEY is required')
    process.exit(1)
  }

  if (!process.env.DEEPGRAM_API_KEY) {
    console.error('❌ Error: DEEPGRAM_API_KEY is required')
    process.exit(1)
  }

  console.log('✅ Environment validation passed')
}
