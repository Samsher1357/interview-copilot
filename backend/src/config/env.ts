import dotenv from 'dotenv'
import path from 'node:path'

// Load environment variables from root .env.local
// This must be loaded before any other modules that use process.env
dotenv.config({ path: path.join(__dirname, '../../../.env.local') })
