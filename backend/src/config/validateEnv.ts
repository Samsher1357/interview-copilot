/**
 * Environment variable validation
 * Validates required environment variables on startup
 */

interface EnvValidationError {
  variable: string
  message: string
}

export function validateEnvironment(): void {
  const errors: EnvValidationError[] = []
  const warnings: string[] = []

  // Required: At least one AI provider
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  const hasGemini = !!process.env.GOOGLE_API_KEY

  if (!hasOpenAI && !hasGemini) {
    errors.push({
      variable: 'OPENAI_API_KEY or GOOGLE_API_KEY',
      message: 'At least one AI provider API key is required',
    })
  }

  // Required: Deepgram for speech recognition
  if (!process.env.DEEPGRAM_API_KEY) {
    errors.push({
      variable: 'DEEPGRAM_API_KEY',
      message: 'Deepgram API key is required for speech recognition',
    })
  }

  // Optional but recommended variables
  if (!process.env.CORS_ORIGIN) {
    warnings.push('CORS_ORIGIN not set. Defaulting to http://localhost:3000')
  }

  if (!process.env.PORT) {
    warnings.push('PORT not set. Defaulting to 3001')
  }

  // Display warnings
  if (warnings.length > 0) {
    console.warn('\n⚠️  Environment Warnings:')
    warnings.forEach(warning => console.warn(`  - ${warning}`))
  }

  // Display errors and exit if any
  if (errors.length > 0) {
    console.error('\n❌ Environment Validation Failed:')
    errors.forEach(({ variable, message }) => {
      console.error(`  - ${variable}: ${message}`)
    })
    console.error('\nPlease check your .env.local file and ensure all required variables are set.')
    console.error('See .env.example for reference.\n')
    process.exit(1)
  }

  console.log('✅ Environment validation passed')
}
