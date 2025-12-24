import { Express } from 'express'
import { deepgramRouter } from './deepgram'
import { resumeRouter } from './resume'

export function setupRoutes(app: Express) {
  app.use('/api/deepgram', deepgramRouter)
  app.use('/api/resume', resumeRouter)
}

