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

  // Required variables
  const required: Record<string, string> = {
    DEEPGRAM_API_KEY: 'Deepgram API key is required for speech recognition',
  }

  // AI Provider validation
  const aiProvider = process.env.AI_PROVIDER || 'openai'
  
  if (aiProvider === 'openai') {
    if (!process.env.OPENAI_API_KEY) {
      errors.push({
        variable: 'OPENAI_API_KEY',
        message: 'OpenAI API key is required when using OpenAI provider',
      })
    }
  } else if (aiProvider === 'gemini') {
    if (!process.env.GOOGLE_API_KEY) {
      errors.push({
        variable: 'GOOGLE_API_KEY',
        message: 'Google API key is required when using Gemini provider',
      })
    }
  } else {
    warnings.push(`Unknown AI provider: ${aiProvider}. Defaulting to OpenAI.`)
  }

  // Check other required variables
  Object.entries(required).forEach(([key, message]) => {
    if (!process.env[key]) {
      errors.push({ variable: key, message })
    }
  })

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

/**
 * Get environment configuration with defaults
 */
export function getEnvConfig() {
  return {
    port: Number.parseInt(process.env.PORT || '3001', 10),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    aiProvider: (process.env.AI_PROVIDER || 'openai') as 'openai' | 'gemini',
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    googleApiKey: process.env.GOOGLE_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    aiMaxTokens: Number.parseInt(process.env.AI_MAX_TOKENS || '1200', 10),
    deepgramApiKey: process.env.DEEPGRAM_API_KEY!,
    nodeEnv: process.env.NODE_ENV || 'development',
  }
}
